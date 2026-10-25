const labels={
  NEV:'nevus (mole)',BCC:'basal cell carcinoma',SCC:'squamous cell carcinoma',
  ACK:'actinic keratosis',SEK:'seborrheic keratosis',MEL:'melanoma',
}
const definitions={
  NEV:'A nevus is a mole made of pigment-producing cells. Most moles are benign and need no treatment, but a new or changing mole should be examined.',
  BCC:'Basal cell carcinoma is a skin cancer that often grows slowly but can damage nearby tissue. A dermatologist can examine it and discuss treatment.',
  SCC:'Squamous cell carcinoma is a skin cancer that can grow deeper and sometimes spread if untreated. A dermatologist can examine it and discuss treatment.',
  ACK:'Actinic keratosis is a rough, sun-damaged spot that can sometimes develop into squamous cell carcinoma. A dermatologist can assess and treat it.',
  SEK:'Seborrheic keratosis is a common, usually harmless skin growth. It often looks waxy or raised and usually needs no treatment.',
  MEL:'Melanoma is a serious skin cancer that can spread. Arrange a prompt dermatology examination to discuss a biopsy and next steps.',
}
const treatments={
  NEV:'Most moles need no medicine. If one is new, changing, itching, or bleeding, ask a dermatologist to examine it instead of trying a removal product.',
  BCC:'A dermatologist may prescribe imiquimod or fluorouracil (5-FU) cream for some biopsy-confirmed superficial basal cell carcinomas. Surgery or Mohs surgery may be more suitable. No over-the-counter cream treats BCC.',
  SCC:'Most localized squamous cell carcinomas are treated with surgical excision or Mohs surgery. For certain advanced cases, a specialist may consider medicines such as cemiplimab. No over-the-counter cream treats SCC.',
  ACK:'A dermatologist may freeze an actinic keratosis or prescribe fluorouracil (5-FU), imiquimod, or tirbanibulin for appropriate areas. These are not over-the-counter spot treatments.',
  SEK:'Most seborrheic keratoses need no medicine. If one is irritated or needs removal, a dermatologist may use freezing or another office procedure. Do not try to remove it at home.',
  MEL:'Melanoma treatment usually begins with surgery. Depending on its stage, a specialist may discuss additional treatments. No over-the-counter medicine treats melanoma.',
}
const nextSteps={
  NEV:'Keep this photo as a baseline. If the mole is new, changing, bleeding, or concerning, arrange a dermatologist visit and bring your photo notes.',
  BCC:'Arrange a dermatologist visit and bring this photo and your notes. A clinician can examine the spot and decide whether a biopsy or treatment is needed.',
  SCC:'Arrange a dermatologist visit soon and bring this photo and your notes. A clinician can decide whether a biopsy is needed and discuss removal options.',
  ACK:'Book a dermatology exam for this rough area and the surrounding sun-exposed skin. Ask whether freezing or prescription treatment would be appropriate.',
  SEK:'Keep this photo for comparison. Have the spot examined if it grows quickly, bleeds, changes appearance, or becomes irritated.',
  MEL:'Arrange a prompt in-person dermatologist examination and bring this photo and your notes. Ask whether a biopsy is needed and what comes next.',
}
const untreated={
  NEV:'Most moles stay harmless, but a new or changing mole should not be ignored. Save dated photos and have concerning changes examined.',
  BCC:'Untreated basal cell carcinoma can grow into and damage nearby tissue, even though spread to distant organs is rare. Arrange a dermatologist visit.',
  SCC:'Untreated squamous cell carcinoma can grow deeper and sometimes spread to nearby lymph nodes. Arrange a dermatologist visit soon.',
  ACK:'An actinic keratosis can persist, and some develop into squamous cell carcinoma. A dermatologist can check and discuss treatment.',
  SEK:'Seborrheic keratoses are usually harmless and often need no treatment. A spot that changes quickly, bleeds, or looks unusual should still be examined.',
  MEL:'Untreated melanoma can grow and spread to other parts of the body. Arrange a prompt in-person dermatology evaluation.',
}
const urgency={
  NEV:'A stable mole usually is not urgent, but arrange a skin exam if it is new, changing, bleeding, or different from your other moles.',
  BCC:'Request a dermatologist appointment soon rather than waiting months. Tell the office if the spot is growing, bleeding, or changing.',
  SCC:'Request a dermatologist appointment soon. Mention growth, bleeding, or a spot on the face, ear, or lip when you call.',
  ACK:'Book a dermatology exam for the rough spot. If it is rapidly changing, bleeding, or painful, mention that when scheduling.',
  SEK:'A stable seborrheic keratosis usually is not urgent. Have a spot checked if it changes quickly, bleeds, or looks unusual.',
  MEL:'Arrange a prompt in-person dermatologist examination. Tell the office about a new or changing spot when scheduling.',
}
const cancerStatus={
  NEV:'A nevus is a mole, and most moles are not cancer. A new or changing spot still needs an in-person examination to rule out melanoma.',
  BCC:'Basal cell carcinoma is a type of skin cancer. A dermatologist can confirm an actual spot with an examination and, if needed, a biopsy.',
  SCC:'Squamous cell carcinoma is a type of skin cancer. A dermatologist can confirm an actual spot with an examination and, if needed, a biopsy.',
  ACK:'Actinic keratosis is usually considered a precancerous growth, not an invasive skin cancer, but some can progress to squamous cell carcinoma. Have a dermatologist assess the spot.',
  SEK:'Seborrheic keratosis is a benign growth, not skin cancer. A dermatologist should still check a spot that changes or looks unusual.',
  MEL:'Melanoma is a serious type of skin cancer. A dermatologist can confirm an actual spot with an examination and biopsy.',
}

export function preparedJudgeAnswer(question,code){
  if(!labels[code]||typeof question!=='string')return null
  const q=question.toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim()
  if(/\b(bring|prepare|take)\b/.test(q)&&/\b(appointment|dermatologist|doctor|visit)\b/.test(q))
    return 'Bring this photo and your notes about when you noticed the spot, any changes in size, shape, or color, and symptoms such as itching, pain, or bleeding. Bring your medication list and questions for the dermatologist.'
  if(/\b(cut|scrape|scrape off|freeze|burn|remove)\b/.test(q)&&/\b(myself|at home|home|diy|off|otc kit|over the counter kit|safe to)\b/.test(q))
    return 'Do not try to remove a skin spot yourself. Home removal can cause bleeding, infection, or scarring and may delay an accurate examination. A dermatologist can assess it and discuss safe options.'
  if(/\b(start|starts|begin|begins|suddenly|new|now)\b/.test(q)&&/\b(bleed|bleeding|pain|hurt|itch)\b/.test(q))
    return 'A new symptom such as bleeding, pain, or itching deserves a dermatologist examination. Note when it began and bring a clear photo; do not wait for a routine photo check if the spot is changing.'
  if(/\b(hydrocortisone|sunscreen)\b/.test(q)&&/\b(treat|cure|remove|heal|work|help)\b/.test(q))
    return `No. ${q.includes('sunscreen')?'Sunscreen helps protect skin from UV damage, but it does not remove or treat this spot.':'Hydrocortisone does not treat '+labels[code]+'.'} Ask a dermatologist about treatment if the spot is changing or concerning.`
  if(/\b(how often|how frequently|how many times)\b/.test(q)&&/\b(photo|photograph|picture|track|monitor|check)\b/.test(q))
    return 'Keep dated photos if you are monitoring a spot, and follow your dermatologist’s advice about how often to check it. If it changes in size, shape, color, or symptoms, do not wait for a scheduled photo—arrange an examination.'
  if(/\b(difference|different|compare|versus|vs)\b/.test(q))return null
  if(/\b(is (this|it|a nevus|a mole|basal cell carcinoma|squamous cell carcinoma|actinic keratosis|seborrheic keratosis|melanoma) (a )?cancer|is this benign)\b/.test(q))return cancerStatus[code]
  if(/\b(ignore|ignored|untreated|leave it alone|do nothing)\b/.test(q))return untreated[code]
  if(/\b(how soon|how quickly|how fast|how urgent|is it urgent|can i wait|should i wait)\b/.test(q))return urgency[code]
  if(code!=='NEV'&&/\bmohs\b/.test(q)&&/\b(why|how|what|choose|work)\b/.test(q))
    return 'Mohs surgery removes a skin cancer layer by layer while checking the edges for remaining cancer cells. A dermatologist may choose it when preserving nearby healthy skin is important, such as on the face or ear, or when a tumor has a higher chance of returning.'
  if(/\b(always|only|every)\b/.test(q)&&/\bmohs\b/.test(q))
    return 'No. Mohs surgery is one treatment option, but not every skin cancer needs it. A dermatologist selects treatment based on the confirmed diagnosis, the spot’s location and size, and other clinical details.'
  if(/\b(side effects?|risks?|dose|dosage|how (do|should|can) i (use|apply)|safe for|allerg(y|ies)|advanced|metastatic|stage|compare|versus)\b/.test(q))return null
  if(/\b(medicine|medicines|medication|drugs?|creams?|otc|over the counter|treatments?|treat|remedy)\b/.test(q))return treatments[code]
  if(/\b(watch|change|changes|monitor|growth|grow|bleed|bleeding|itch)\b/.test(q))
    return 'Watch for a spot that grows, changes shape or color, looks different from your other spots, or starts itching, hurting, or bleeding. Save dated photos and have a new or changing spot examined.'
  if(/^(what is|what does (this|the|my) (result|diagnosis|condition) mean|what do i have|explain (this|the) (result|condition))/.test(q))return definitions[code]
  if(/\b(next steps?|what should i do|what do i do|do i need (an? )?(appointment|dermatologist|doctor)|should i (see|visit|book|schedule))\b/.test(q))return nextSteps[code]
  return null
}
