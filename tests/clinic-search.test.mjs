import test from 'node:test'
import assert from 'node:assert/strict'
import { findDermatologyOffices, selectDermatologyOffices } from '../clinic-search.mjs'

test('uses dermatology practice addresses, not mailing addresses', () => {
  const results = [
    {number:1234567890,enumeration_type:'NPI-1',basic:{first_name:'Ada',last_name:'Lee',status:'A'},taxonomies:[{code:'207N00000X',desc:'Dermatology'}],addresses:[
      {address_purpose:'MAILING',address_1:'1 Mail St',city:'Chicago',state:'IL',postal_code:'60601'},
      {address_purpose:'LOCATION',address_1:'2 Practice St',city:'Aspen',state:'CO',postal_code:'81611'}]},
    {number:2345678901,enumeration_type:'NPI-2',basic:{organization_name:'Skin Office',status:'A'},taxonomies:[{code:'207N00000X',desc:'Dermatology'}],addresses:[
      {address_purpose:'LOCATION',address_1:'3 Practice St',city:'Chicago',state:'IL',postal_code:'60601-1234',telephone_number:'312-555-0100'}]}
  ]
  assert.deepEqual(selectDermatologyOffices(results,'60601').map(item=>item.name),['Skin Office'])
})

test('rejects an invalid ZIP without contacting the directory', async () => {
  await assert.rejects(findDermatologyOffices('60abc',()=>{throw new Error('called')}),/five-digit/)
})

test('adds same-city practice listings when a ZIP has few results', async () => {
  const fetcher=async url=>{
    const address={address_purpose:'LOCATION',address_1:'4 Main St',city:'Chicago',state:'IL',postal_code:'60602'}
    if(String(url).includes('zippopotam'))return {ok:true,json:async()=>({places:[{'place name':'Chicago','state abbreviation':'IL'}]})}
    if(String(url).includes('city=Chicago'))return {ok:true,json:async()=>({results:[{number:3456789012,enumeration_type:'NPI-2',basic:{organization_name:'City Dermatology'},taxonomies:[{code:'207N00000X'}],addresses:[address]}]})}
    return {ok:true,json:async()=>({results:[]})}
  }
  const result=await findDermatologyOffices('60601',fetcher)
  assert.equal(result.area,'Chicago, IL')
  assert.equal(result.offices[0].zip,'60602')
})
