// Wording for the front desk tablet (kiosk.js) in English and Spanish, and the Spanish
// reference translation of the waiver. Members pick the language on the welcome screen.
//
// The Spanish waiver is a REFERENCE TRANSLATION written by Claude, not a certified legal
// translation. Spanish speakers see it above the official English waiver, which is the one they
// sign; the saved waiver records that they read it with this translation. It follows the meaning
// of the English (for example "convention to sue" is translated as the intended "covenant not to
// sue"). A fluent speaker should check it before relying on it.

let kioskLang = 'en';   // 'en' or 'es'; back to English for each new person

const KIOSK_TEXT = {
  en: {
    welcomeTitle: 'Welcome to Academy Martial Arts',
    welcomeText: 'New here, or need to update your details? Fill in the form and sign the waiver. It takes about 3 minutes.',
    startEn: 'Start in English',
    startEs: 'Empezar en español',
    yourDetails: 'Your details',
    cancel: 'Cancel',
    aboutYou: 'About you',
    firstName: 'First name *',
    lastName: 'Last name *',
    dob: 'Date of birth *',
    sex: 'Sex',
    male: 'Male',
    female: 'Female',
    contact: 'Contact',
    phoneReq: 'Phone *',
    altPhone: 'Alt phone',
    email: 'Email',
    street: 'Street address',
    city: 'City',
    state: 'State',
    zip: 'Zip',
    medical: 'Medical conditions',
    medicalLabel: 'Anything your coach should know',
    medicalHint: '(or “none”)',
    emergency: 'Emergency contact',
    nameReq: 'Name *',
    relation: 'Relation',
    relationPh: 'e.g. Mom',
    parentSection: 'Parent or guardian',
    ifUnder18: '(if under 18)',
    minorNote: 'If you’re under 18, a parent or guardian needs to fill this in and sign the waiver below.',
    minorNoteYes: '<strong>You’re under 18</strong>, so a parent or guardian needs to fill this in and sign the waiver below.',
    parentName: 'Parent/guardian name',
    relationship: 'Relationship',
    relationshipPh: 'e.g. Mom, Dad',
    phone: 'Phone',
    train: 'What would you like to train?',
    trainNote: 'Kickboxing is included with Muay Thai and Jiu Jitsu. The front desk will confirm the price.',
    programs: { kickboxing: 'Kickboxing', muay_thai: 'Muay Thai', jiu_jitsu: 'Jiu Jitsu', all: 'All 3', '': 'Not sure yet' },
    waiver: 'Waiver',
    yourSig: 'Your signature',
    optional: '(optional)',
    parentSig: 'Parent/guardian signature',
    clear: 'Clear',
    sigAria: 'Your signature: sign with your finger',
    parentSigAria: 'Parent or guardian signature: sign with your finger',
    date: 'Date',
    agree: 'I have read this waiver and agree to it.',
    finish: 'Finish',
    saving: 'Saving…',
    eName: 'Please add your first and last name.',
    eDob: 'Please add your date of birth.',
    eDobFuture: 'Your date of birth is in the future.',
    ePhone: 'Please add a phone number.',
    eEmail: 'That email doesn’t look right.',
    eEmergency: 'Please add an emergency contact name and phone.',
    eProgram: 'Please choose what you’d like to train (or “Not sure yet”).',
    eSign: 'Please sign the waiver in the box.',
    eParentName: 'You’re under 18: please add your parent or guardian’s name.',
    eParentPhone: 'Please add your parent or guardian’s phone number.',
    eParentEmail: 'The parent or guardian’s email doesn’t look right.',
    eParentSign: 'A parent or guardian needs to sign the waiver in the box.',
    eAgree: 'Please tick the box to agree to the waiver.',
    eSave: 'Sorry, that didn’t save ({msg}). Please ask the front desk for help.',
    eWaiver: 'Your details were saved, but the waiver wasn’t. Please ask the front desk to help you sign it.',
    doneTitle: 'All done{name}!',
    doneText: 'Thanks. Your details and waiver are saved. Please hand the tablet back to the front desk.',
    done: 'Done',
    idle: 'The form was cleared because no one was using it.'
  },
  es: {
    welcomeTitle: 'Bienvenidos a Academy Martial Arts',
    welcomeText: '¿Es nuevo o necesita actualizar sus datos? Llene el formulario y firme la exención. Toma unos 3 minutos.',
    startEn: 'Start in English',
    startEs: 'Empezar en español',
    yourDetails: 'Sus datos',
    cancel: 'Cancelar',
    aboutYou: 'Sobre usted',
    firstName: 'Nombre *',
    lastName: 'Apellido *',
    dob: 'Fecha de nacimiento *',
    sex: 'Sexo',
    male: 'Masculino',
    female: 'Femenino',
    contact: 'Contacto',
    phoneReq: 'Teléfono *',
    altPhone: 'Otro teléfono',
    email: 'Correo electrónico',
    street: 'Dirección',
    city: 'Ciudad',
    state: 'Estado',
    zip: 'Código postal',
    medical: 'Condiciones médicas',
    medicalLabel: 'Algo que su instructor deba saber',
    medicalHint: '(o “ninguna”)',
    emergency: 'Contacto de emergencia',
    nameReq: 'Nombre *',
    relation: 'Parentesco',
    relationPh: 'p. ej. Mamá',
    parentSection: 'Padre, madre o tutor',
    ifUnder18: '(si es menor de 18 años)',
    minorNote: 'Si es menor de 18 años, su padre, madre o tutor debe llenar esta parte y firmar la exención abajo.',
    minorNoteYes: '<strong>Es menor de 18 años</strong>, así que su padre, madre o tutor debe llenar esta parte y firmar la exención abajo.',
    parentName: 'Nombre del padre, madre o tutor',
    relationship: 'Parentesco',
    relationshipPh: 'p. ej. Mamá, Papá',
    phone: 'Teléfono',
    train: '¿Qué le gustaría entrenar?',
    trainNote: 'Kickboxing está incluido con Muay Thai y Jiu Jitsu. La recepción le confirmará el precio.',
    programs: { kickboxing: 'Kickboxing', muay_thai: 'Muay Thai', jiu_jitsu: 'Jiu Jitsu', all: 'Los 3', '': 'Todavía no sé' },
    waiver: 'Exención de responsabilidad',
    yourSig: 'Su firma',
    optional: '(opcional)',
    parentSig: 'Firma del padre, madre o tutor',
    clear: 'Borrar',
    sigAria: 'Su firma: firme con el dedo',
    parentSigAria: 'Firma del padre, madre o tutor: firme con el dedo',
    date: 'Fecha',
    agree: 'He leído esta exención y estoy de acuerdo.',
    finish: 'Terminar',
    saving: 'Guardando…',
    eName: 'Por favor escriba su nombre y apellido.',
    eDob: 'Por favor escriba su fecha de nacimiento.',
    eDobFuture: 'Su fecha de nacimiento está en el futuro.',
    ePhone: 'Por favor escriba un número de teléfono.',
    eEmail: 'Ese correo electrónico no parece correcto.',
    eEmergency: 'Por favor escriba el nombre y teléfono de un contacto de emergencia.',
    eProgram: 'Por favor elija qué le gustaría entrenar (o “Todavía no sé”).',
    eSign: 'Por favor firme la exención en el recuadro.',
    eParentName: 'Es menor de 18 años: por favor escriba el nombre de su padre, madre o tutor.',
    eParentPhone: 'Por favor escriba el teléfono de su padre, madre o tutor.',
    eParentEmail: 'El correo electrónico del padre, madre o tutor no parece correcto.',
    eParentSign: 'Su padre, madre o tutor debe firmar la exención en el recuadro.',
    eAgree: 'Por favor marque la casilla para aceptar la exención.',
    eSave: 'Lo sentimos, no se guardó ({msg}). Por favor pida ayuda en la recepción.',
    eWaiver: 'Sus datos se guardaron, pero la exención no. Por favor pida ayuda en la recepción para firmarla.',
    doneTitle: '¡Listo{name}!',
    doneText: 'Gracias. Sus datos y la exención están guardados. Por favor devuelva la tableta a la recepción.',
    done: 'Listo',
    idle: 'El formulario se borró porque nadie lo estaba usando.',
    // Spanish only: shown above the translated waiver and the official English one.
    refNote: '<strong>Traducción de referencia.</strong> La versión oficial es la de inglés que aparece abajo; su firma se aplica a esa versión.',
    officialEnglish: 'Versión oficial en inglés (esta es la que usted firma):'
  }
};

// Text for the current language. {name}-style placeholders are filled from vars.
function t(key, vars = {}) {
  const text = KIOSK_TEXT[kioskLang][key] ?? KIOSK_TEXT.en[key];
  return typeof text === 'string' ? text.replace(/{(\w+)}/g, (_, k) => vars[k] ?? '') : text;
}

const WAIVER_ES = {
  title: 'Formulario de exención de responsabilidad',
  paragraphs: [
    'A mi leal saber y entender, estoy en buena condición física y plenamente capacitado/a para ' +
    'participar en todos los programas y actividades que se ofrecen. Reconozco que el programa puede ' +
    'incluir actividad física intensa, incluyendo, entre otros, entrenamiento de fuerza y resistencia ' +
    'muscular, acondicionamiento y entrenamiento cardiovascular, y otras actividades físicas diversas. ' +
    'Por la presente afirmo que estoy en buena condición física y que no padezco ninguna discapacidad ' +
    'o condición conocida que me impida o limite participar en este programa de ejercicio. Reconozco ' +
    'que mi inscripción y participación posterior son totalmente voluntarias y de ninguna manera ' +
    'obligatorias. Soy plenamente consciente de los riesgos y peligros relacionados con la ' +
    'participación en diversas formas de entrenamiento de artes marciales, ejercicios de ' +
    'acondicionamiento físico/aeróbicos y actividad física, incluyendo lesiones físicas o la muerte, ' +
    'y por la presente elijo participar voluntariamente sabiendo que la actividad física asociada ' +
    'puede ser peligrosa para mí o para mis bienes. Asumo voluntariamente toda la responsabilidad por ' +
    'cualquier riesgo o pérdida, daño a la propiedad o lesión personal, incluida la muerte, que yo ' +
    'pueda sufrir, o por la pérdida o daño de bienes de mi propiedad, como resultado de mi ' +
    'participación. Además, certifico que tengo al menos 18 años de edad. Si soy menor de 18 años, mi ' +
    'padre, madre o tutor es quien firma abajo.',

    'Por la presente LIBERO, RENUNCIO A TODO RECLAMO, EXONERO Y ME COMPROMETO A NO DEMANDAR a Academy ' +
    'NL LLC (Academy Kickboxing) (Academy Martial Arts) (Academy Muay Thai), Danke and Sons LLC, ' +
    'Cornerstone Christian Karate, Wanderlay Jiu-Jitsu, Resurgence, y a sus propietarios, directivos, ' +
    'agentes, empleados, contratistas, servidores, asociados, invitados, afiliados, etc., de toda ' +
    'responsabilidad, reclamo, demanda, acción y causa de acción de cualquier tipo que surja de o esté ' +
    'relacionada con cualquier pérdida, daño o lesión, incluida la muerte, que yo pueda sufrir, o con ' +
    'cualquier bien de mi propiedad.',

    'Es mi intención expresa que este acuerdo de exoneración y de exención de responsabilidad obligue ' +
    'a los miembros de mi familia y a mi cónyuge, si estoy vivo/a, y a mis herederos, cesionarios y ' +
    'representante personal, si he fallecido, y que se considere una liberación, renuncia, exoneración ' +
    'y compromiso de no demandar a las partes liberadas mencionadas anteriormente. Además, acepto que ' +
    'esta exención de responsabilidad y acuerdo de exoneración se interpretará de acuerdo con las leyes ' +
    'del Estado de Wisconsin.',

    'Al firmar esta exoneración, reconozco y declaro que he leído la Exención de Responsabilidad y el ' +
    'Acuerdo de Exoneración anteriores, que los entiendo y que los firmo voluntariamente como un acto ' +
    'libre y propio; que no se han hecho declaraciones, afirmaciones ni incentivos verbales aparte de ' +
    'los acuerdos escritos anteriores; y que firmo esta exoneración a cambio de una contraprestación ' +
    'total, adecuada y completa, con plena intención de quedar obligado/a por la misma.'
  ]
};

// The Spanish reference translation as one block of text, in the same shape as waiverText().
function waiverTextEs() {
  return [WAIVER.gym, WAIVER_ES.title, ...WAIVER_ES.paragraphs].join('\n\n');
}

// What a signed waiver saves: always the official English wording. A Spanish signer's record
// also keeps the translation they read alongside it.
function signedWaiverText() {
  if (kioskLang !== 'es') return waiverText();
  return [waiverText(), '— Read with the Spanish reference translation shown on the tablet: —',
    waiverTextEs()].join('\n\n');
}
