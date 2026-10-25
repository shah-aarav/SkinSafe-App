export function selectDermatologyOffices(results, zip, city = '', state = '') {
  const seen = new Set()
  const offices = []
  for (const provider of results || []) {
    if (provider.basic?.status && provider.basic.status !== 'A') continue
    if (!provider.taxonomies?.some(item => /^207N/.test(item.code || '') || /dermatolog/i.test(item.desc || ''))) continue
    const name = provider.enumeration_type === 'NPI-2'
      ? provider.basic?.organization_name
      : [provider.basic?.first_name, provider.basic?.last_name].filter(Boolean).join(' ')
    if (!name || !/^\d{10}$/.test(String(provider.number))) continue
    for (const address of [...(provider.addresses || []), ...(provider.practiceLocations || [])]) {
      if (address.address_purpose && address.address_purpose !== 'LOCATION') continue
      const exactZip = String(address.postal_code || '').slice(0, 5) === zip
      const sameCity = city && state && address.city?.toLowerCase() === city.toLowerCase() && address.state?.toUpperCase() === state.toUpperCase()
      if ((!exactZip && !sameCity) || !address.address_1 || !address.city || !address.state) continue
      const key = `${provider.number}:${address.address_1}:${address.postal_code}`
      if (seen.has(key)) continue
      seen.add(key)
      offices.push({npi:String(provider.number),name,address1:address.address_1,address2:address.address_2 || '',city:address.city,state:address.state,zip:String(address.postal_code).slice(0,5),phone:address.telephone_number || ''})
    }
  }
  return offices.sort((a,b)=>a.name.localeCompare(b.name)).slice(0, 8)
}

export async function findDermatologyOffices(zip, fetcher = fetch) {
  if (!/^\d{5}$/.test(zip)) throw Object.assign(new Error('Enter a five-digit U.S. ZIP code.'), {status:400})
  async function registry(params) {
    const url = new URL('https://npiregistry.cms.hhs.gov/api/')
    url.search = new URLSearchParams({version:'2.1',taxonomy_description:'Dermatology',limit:'200',...params}).toString()
    const response = await fetcher(url, {signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}})
    if (!response.ok) throw new Error('The provider directory is unavailable. Try again later.')
    return (await response.json()).results || []
  }
  const exact = selectDermatologyOffices(await registry({postal_code:zip}),zip)
  if (exact.length >= 8) return {offices:exact,area:`ZIP ${zip}`}
  try {
    const response = await fetcher(`https://api.zippopotam.us/us/${zip}`, {signal:AbortSignal.timeout(6000),headers:{Accept:'application/json'}})
    if (!response.ok) return {offices:exact,area:`ZIP ${zip}`}
    const place = (await response.json()).places?.[0]
    const city = place?.['place name'], state = place?.['state abbreviation']
    if (!city || !state) return {offices:exact,area:`ZIP ${zip}`}
    const cityOffices = selectDermatologyOffices(await registry({city,state}),zip,city,state)
    const seen = new Set(exact.map(item=>`${item.npi}:${item.address1}:${item.zip}`))
    const combined = [...exact,...cityOffices.filter(item=>!seen.has(`${item.npi}:${item.address1}:${item.zip}`))].slice(0,8)
    return {offices:combined,area:combined.some(item=>item.zip!==zip)?`${city}, ${state}`:`ZIP ${zip}`}
  } catch { return {offices:exact,area:`ZIP ${zip}`} }
}
