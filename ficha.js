// Estructura de la ficha "Informe de Examen Oftálmico".
// Sintaxis de cada fila: [etiqueta de la fila, "opción|opción|..."]
//   texto normal  -> casilla (chip)
//   "#Etiqueta"   -> campo de texto corto
//   "@Etiqueta"   -> campo de texto largo
//   "*Etiqueta"   -> opción única (como los pronósticos)
// eye:true  -> la sección se repite para ojo derecho e izquierdo.
export const SCHEMA = [
  { t: 'Globo ocular', eye: true, rows: [
    ['', 'normal|estrabismo|ptisis bulbi|retropulsión|exoftalmia|enoftalmia|microftalmia|buftalmia'],
  ]},
  { t: 'Reflejos', eye: true, rows: [
    ['Pupilar directo blanco', '<4 mm|>4 mm|escape|ausente'],
    ['Pupilar directo rojo', '<4 mm|>4 mm|escape|ausente'],
    ['Pupilar directo azul', '<4 mm|>4 mm|ausente'],
    ['Pupilar consensual', '<2 seg|lento|ausente'],
    ['Palpebral', 'normal|parcial|ausente'],
    ['Corneal', 'normal|parcial|ausente'],
    ['Deslumbramiento', 'normal|disminuido|ausente'],
    ['Respuesta a la amenaza', 'normal|ausente'],
  ]},
  { t: 'PIO', eye: true, rows: [['', '#PIO (mmHg)']] },
  { t: 'Aparato lagrimal', eye: true, rows: [
    ['', 'normal|epífora|#Schirmer (mm/min)'],
    ['', '#Rotura fluoresceína (seg)|#Pasaje (min)|Micro puntos|agenesia de ptos|#Otro'],
  ]},
  { t: 'Secreciones', eye: true, rows: [['', 'acuosa|mucoide|purulenta|adheridas']] },
  { t: 'Párpados', eye: true, rows: [
    ['', 'normales|triquiasis|distiquiasis|blefaritis'],
    ['', 'alopecia|edema|blefaroespasmo|Diamante'],
    ['', 'entropión del canto nasal|entropión|ectropión'],
    ['', 'Triquiasis carúncula|neoplasia|meibomitis'],
  ]},
  { t: 'Tercer párpado', eye: true, rows: [
    ['', 'normal|despigmentado|hiperémico|protruido'],
    ['', 'prolapso glándula|eversión|C. folicular|#Otro'],
  ]},
  { t: 'Conjuntiva', eye: true, rows: [
    ['', 'normal|vasos superficiales|vasos profundos'],
    ['', 'hiperemia|congestión|quemosis|quemosis lineal'],
    ['', 'folículos linfoides|cilio ectópico|#Otro'],
  ]},
  { t: 'Córnea y esclerótica', eye: true, rows: [
    ['', 'normal|edema|endotelitis|pigmentada'],
    ['Distrofia', 'epitelial|estromal|endotelial'],
    ['Vascularización', 'superficial|profunda'],
    ['Fluoresceína / Verde de lisamina', '#Resultado'],
    ['Úlcera', 'U. superficial|U. profunda|Descemetocele|DEEC'],
    ['', 'Perforación corneal|Nébula|Mácula|leucoma'],
  ]},
  { t: 'Iris', eye: true, rows: [
    ['', 'normal|rubeosis|algodonoso|atrofia|repigmentado'],
    ['Sinequias', 'anterior|posterior|bloqueo'],
    ['Membrana pupilar persistente', 'iris-iris|iris a córnea|iris a cristalino'],
    ['', 'iridonesis|no evaluable'],
  ]},
  { t: 'Pupila', eye: true, rows: [
    ['', 'normal|midriasis|miosis|irregular|discordia|no evaluable|#Otro'],
  ]},
  { t: 'Cámaras anterior y posterior', eye: true, rows: [
    ['', 'normal|disminuida|aumentada|hipopión|hifema|fibrina|no evaluable'],
    ['', '#Tyndall|#Otro'],
  ]},
  { t: 'Cristalino', eye: true, rows: [
    ['', 'normal|esclerosis senil|subluxación'],
    ['Luxación', 'anterior|posterior'],
    ['', 'Catarata|no evaluable'],
  ]},
  { t: 'Vítreo y fondo de ojo', eye: true, rows: [
    ['', 'normal evaluado sin midriasis|no evaluable'],
    ['', '#Humor vítreo'],
    ['', '#Retina'],
  ]},
  { t: 'Exámenes complementarios', eye: false, rows: [
    ['Presión arterial sistémica', '#Sistólica (mmHg)|#Diastólica (mmHg)|#Media (mmHg)'],
    ['Solicitados', 'Hemograma|Bioquímica sanguínea completa|TSH|T4|SDMA|Ecografía ocular|Electroretinograma'],
  ]},
  { t: 'Diagnóstico y tratamiento', eye: false, rows: [
    ['', '@Diagnóstico'],
    ['', '@Tratamiento'],
    ['', '@Revisión'],
  ]},
  { t: 'Pronóstico para la visión', eye: false, rows: [
    ['', '*Favorable|*Reservado a favorable|*Reservado a desfavorable|*Desfavorable'],
  ]},
];

export const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export function parseItem(raw) {
  const c = raw[0];
  if (c === '#') return { kind: 'text', label: raw.slice(1) };
  if (c === '@') return { kind: 'area', label: raw.slice(1) };
  if (c === '*') return { kind: 'radio', label: raw.slice(1) };
  return { kind: 'check', label: raw };
}

// Clave estable con la que se guarda cada casilla o campo
export const baseKey = (sec, rowLabel) => slug(sec.t) + '.' + slug(rowLabel || 'x');
export const itemKey = (sec, rowLabel, it) =>
  it.kind === 'radio' ? baseKey(sec, rowLabel) : baseKey(sec, rowLabel) + '.' + slug(it.label);
