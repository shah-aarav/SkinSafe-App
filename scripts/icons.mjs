import sharp from 'sharp'
await Promise.all([192,512].map(size => sharp('public/skinsafe-mark.png').resize(size,size).flatten({background:'#171717'}).png().toFile(`public/icon-${size}.png`)))
