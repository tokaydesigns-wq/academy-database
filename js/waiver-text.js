// The gym's liability waiver, copied word for word (typos included) from page 2 of
// "Academy Enrollment.pdf". This is a legal document: don't change the wording without the
// owner's say-so. If it does change, bump `version`, and members who signed an older
// version will be asked to sign again.

const WAIVER = {
  version: '1',
  title: 'Liability Waiver Form',
  gym: 'ACADEMY MARTIAL ARTS',
  paragraphs: [
    'To the best of my knowledge, I am in good physical condition and fully able to participate in all ' +
    'programs and activities offered. I recognize that the program may involve strenuous physical ' +
    'activity including, but not limited to, muscle strength and endurance training, cardiovascular ' +
    'conditioning and training, and other various fitness activities. I hereby affirm that I am in good ' +
    'physical condition and do not suffer from any known disability or condition which would prevent or ' +
    'limit my participation in this exercise program. I acknowledge that my enrollment and subsequent ' +
    'participation in purely voluntary and in no way mandated. I am fully aware of the risks and hazards ' +
    'connected with the participation in various forms of Martial Arts training, fitness/aerobic exercises ' +
    'and physical activity including physical injury or death, and herby elect to voluntarily participate ' +
    'knowing that the associated physical activity may be hazardous to me or my property. I voluntarily ' +
    'assume full responsibility for any risks or loss, property damage, or personal injury, including death, ' +
    'which may be sustained by me, or loss or damage to property owned by me, as a result of ' +
    'participation. I further certify that I am at least 18 years of age. If under 18, my parent/guardian is ' +
    'the below signed.',

    'I hereby RELEASE, WAIVE, DISCHARGE, AND COVENANT NOT TO SUE, Academy NL LLC ' +
    '(Academy Kickboxing) (Academy Martial Arts) (Academy Muay Thai), Danke and Sons LLC, ' +
    'Cornerstone Christian Karate, Wanderlay Jiu-Jitsu, Resurgence, their owners, officers, agents, ' +
    'employees, contractors, servants, associates, guests, affiliates, etc. from any and all liability, ' +
    'claims, demands, actions and causes of action whatsoever arising out of or related to any loss, ' +
    'damage, or injury, including death, that may be sustained by me, or to any property belonging to ' +
    'me.',

    'It is my expressed intent that this release and hold harmless agreement shall bind the members of ' +
    'my family and spouse, if I am alive, and my heirs, assigns and personal representative, if I am ' +
    'deceased, and shall be deemed as a release, waive, discharge, and convention to sue the above ' +
    'named releases. I hereby further agree that this waiver of liability and hold harmless agreement ' +
    'shall be constructed in accordance with the laws of the State of Wisconsin.',

    'In signing this release, I acknowledge and represent that I have read the foregoing waiver of ' +
    'Liability and Hold Harmless Agreement, Understand it and sign it voluntarily as my own free act and ' +
    'deed; no oral representations, statements or inducements, apart from the foregoing written ' +
    'agreements have been made; and I execute this release for full, adequate and complete ' +
    'consideration fully intending to be bound by the same.'
  ]
};

// The full wording as one block of text, as saved with each signed waiver.
function waiverText() {
  return [WAIVER.gym, WAIVER.title, ...WAIVER.paragraphs].join('\n\n');
}
