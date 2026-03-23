/**
 * Catálogos fijos para dropdowns — sin campos de texto libre.
 * Categorías, unidades, países, departamentos GT, municipios GT.
 */

export const CATEGORIAS = [
  'Verduras',
  'Frutas',
  'Hierbas y Aromáticas',
  'Raíces y Tubérculos',
  'Granos y Legumbres',
  'Exportación',
  'Empaque / Presentaciones',
  'Procesados',
];

export const UNIDADES = [
  'Caja',
  'Bolsa',
  'Malla',
  'Saco',
  'Bandeja',
  'Paquete',
  'Unidad',
  'Docena',
  'Ciento',
  'Kg',
  'Libra (lb)',
  'Quintal',
];

export const PAISES = [
  'Guatemala',
  'El Salvador',
  'Honduras',
  'Nicaragua',
  'Costa Rica',
  'México',
  'Estados Unidos',
  'Otro',
];

// 22 departamentos de Guatemala
export const DEPARTAMENTOS_GT = [
  'Guatemala',
  'Alta Verapaz',
  'Baja Verapaz',
  'Chimaltenango',
  'Chiquimula',
  'El Progreso',
  'Escuintla',
  'Huehuetenango',
  'Izabal',
  'Jalapa',
  'Jutiapa',
  'Petén',
  'Quetzaltenango',
  'Quiché',
  'Retalhuleu',
  'Sacatepéquez',
  'San Marcos',
  'Santa Rosa',
  'Sololá',
  'Suchitepéquez',
  'Totonicapán',
  'Zacapa',
];

// Municipios por departamento
export const MUNICIPIOS_GT = {
  'Guatemala': [
    'Guatemala (Ciudad)', 'Chinautla', 'Chuarrancho', 'Fraijanes', 'Amatitlán',
    'Mixco', 'Petapa', 'San Juan Sacatepéquez', 'San Pedro Ayampuc',
    'San Pedro Sacatepéquez', 'San Raymundo', 'Santa Catarina Pinula',
    'Villa Canales', 'Villa Nueva', 'Palencia',
  ],
  'Alta Verapaz': [
    'Cobán', 'Cahabón', 'Chisec', 'Fray Bartolomé de las Casas', 'La Tinta',
    'Lanquín', 'Panzós', 'Raxruhá', 'San Cristóbal Verapaz', 'San Juan Chamelco',
    'San Pedro Carchá', 'Santa Catalina La Tinta', 'Senahú', 'Tamahú',
    'Tactic', 'Tucurú',
  ],
  'Baja Verapaz': [
    'Salamá', 'Cubulco', 'Granados', 'Purulhá', 'Rabinal',
    'San Jerónimo', 'San Miguel Chicaj', 'Santa Cruz El Chol',
  ],
  'Chimaltenango': [
    'Chimaltenango', 'Acatenango', 'El Tejar', 'Parramos', 'Patzicía',
    'Patzún', 'Pochuta', 'San Andrés Itzapa', 'San José Poaquil',
    'San Juan Comalapa', 'San Martín Jilotepeque', 'Santa Apolonia',
    'Santa Cruz Balanyá', 'Tecpán Guatemala', 'Yepocapa', 'Zaragoza',
  ],
  'Chiquimula': [
    'Chiquimula', 'Camotán', 'Concepción Las Minas', 'Esquipulas',
    'Ipala', 'Jocotán', 'Olopa', 'Quezaltepeque', 'San Jacinto',
    'San Juan Ermita', 'San José La Arada',
  ],
  'El Progreso': [
    'Guastatoya', 'El Jícaro', 'Morazán', 'San Agustín Acasaguastlán',
    'San Antonio La Paz', 'San Cristóbal Acasaguastlán', 'Sanarate', 'Sansare',
  ],
  'Escuintla': [
    'Escuintla', 'Guanagazapa', 'Iztapa', 'La Democracia', 'La Gomera',
    'Masagua', 'Nueva Concepción', 'Palín', 'San José', 'San Vicente Pacaya',
    'Santa Lucía Cotzumalguapa', 'Siquinalá', 'Tiquisate',
  ],
  'Huehuetenango': [
    'Huehuetenango', 'Aguacatán', 'Chiantla', 'Colotenango', 'Concepción Huista',
    'Cuilco', 'Jacaltenango', 'La Democracia', 'La Libertad', 'Malacatancito',
    'Nentón', 'San Antonio Huista', 'San Ildefonso Ixtahuacán',
    'San Juan Atitán', 'San Juan Ixcoy', 'San Mateo Ixtatán',
    'San Miguel Acatán', 'San Pedro Necta', 'San Pedro Soloma',
    'San Rafael La Independencia', 'San Rafael Petzal', 'San Sebastián Coatán',
    'San Sebastián Huehuetenango', 'Santa Ana Huista', 'Santa Bárbara',
    'Santa Cruz Barillas', 'Santa Eulalia', 'Santiago Chimaltenango',
    'Tectitán', 'Todos Santos Cuchumatán', 'Unión Cantinil',
  ],
  'Izabal': ['Puerto Barrios', 'El Estor', 'Livingston', 'Los Amates', 'Morales'],
  'Jalapa': ['Jalapa', 'Mataquescuintla', 'Monjas', 'San Carlos Alzatate', 'San Luis Jilotepeque', 'San Manuel Chaparrón', 'San Pedro Pinula'],
  'Jutiapa': [
    'Jutiapa', 'Agua Blanca', 'Asunción Mita', 'Atescatempa', 'Comapa',
    'Conguaco', 'El Adelanto', 'El Progreso', 'Jalpatagua', 'Jerez',
    'Moyuta', 'Pasaco', 'Quesada', 'San José Acatempa', 'Santa Catarina Mita',
    'Yupiltepeque', 'Zapotitlán',
  ],
  'Petén': ['Flores', 'Dolores', 'El Chal', 'La Libertad', 'Las Cruces', 'Melchor de Mencos', 'Poptún', 'San Andrés', 'San Benito', 'San Francisco', 'San José', 'San Luis', 'Santa Ana', 'Sayaxché'],
  'Quetzaltenango': [
    'Quetzaltenango', 'Almolonga', 'Cabricán', 'Cajolá', 'Cantel',
    'Coatepeque', 'Colomba', 'Concepción Chiquirichapa', 'El Palmar',
    'Flores Costa Cuca', 'Génova', 'Huitán', 'La Esperanza', 'Melchor de Mencos',
    'Olintepeque', 'Ostuncalco', 'Palestina de Los Altos', 'Salcajá',
    'San Carlos Sija', 'San Francisco La Unión', 'San Juan Ostuncalco',
    'San Marcos', 'San Martín Sacatepéquez', 'San Mateo', 'San Miguel Sigüilá',
    'Sibilia', 'Zunil',
  ],
  'Quiché': [
    'Santa Cruz del Quiché', 'Canillá', 'Chajul', 'Chicamán',
    'Chiché', 'Chichicastenango', 'Chinique', 'Cunén', 'Ixcán',
    'Joyabaj', 'Nebaj', 'Pachalum', 'Patzité', 'Sacapulas',
    'San Andrés Sajcabajá', 'San Antonio Ilotenango', 'San Bartolomé Jocotenango',
    'San Juan Cotzal', 'San Pedro Jocopilas', 'Sipacapa', 'Uspantán', 'Zacualpa',
  ],
  'Retalhuleu': ['Retalhuleu', 'Champerico', 'El Asintal', 'Nuevo San Carlos', 'Pajapita', 'San Andrés Villa Seca', 'San Felipe', 'San Marcos', 'San Martín Zapotitlán', 'San Sebastián', 'Santa Cruz Muluá'],
  'Sacatepéquez': ['Antigua Guatemala', 'Alotenango', 'Ciudad Vieja', 'Jocotenango', 'Magdalena Milpas Altas', 'Pastores', 'San Antonio Aguas Calientes', 'San Bartolomé Milpas Altas', 'San Lucas Sacatepéquez', 'San Miguel Dueñas', 'Santa Catarina Barahona', 'Santa Lucía Milpas Altas', 'Santa María de Jesús', 'Santiago Sacatepéquez', 'Santo Domingo Xenacoj', 'Sumpango'],
  'San Marcos': ['San Marcos', 'Ayutla', 'Catarina', 'Comitancillo', 'Concepción Tutuapa', 'El Quetzal', 'El Rodeo', 'El Tumbador', 'Esquipulas Palo Gordo', 'Ixchiguán', 'La Blanca', 'La Reforma', 'Malacatán', 'Nuevos Progreso', 'Ocós', 'Pajapita', 'Río Blanco', 'San Antonio Sacatepéquez', 'San Cristóbal Cucho', 'San José El Rodeo', 'San José Ojetenám', 'San Lorenzo', 'San Miguel Ixtahuacán', 'San Pablo', 'San Pedro Sacatepéquez', 'San Rafael Pie de La Cuesta', 'Sibinal', 'Sipacapa', 'Tacaná', 'Tajumulco', 'Tejutla'],
  'Santa Rosa': ['Cuilapa', 'Barberena', 'Casillas', 'Chiquimulilla', 'Guazacapán', 'Nueva Santa Rosa', 'Oratorio', 'Pueblo Nuevo Viñas', 'San Juan Tecuaco', 'San Rafael Las Flores', 'Santa Cruz Naranjo', 'Santa María Ixhuatán', 'Santa Rosa de Lima', 'Taxisco'],
  'Sololá': ['Sololá', 'Concepción', 'Nahualá', 'Panajachel', 'San Andrés Semetabaj', 'San Antonio Palopó', 'San José Chacayá', 'San Juan La Laguna', 'San Lucas Tolimán', 'San Marcos La Laguna', 'San Pablo La Laguna', 'San Pedro La Laguna', 'Santa Catarina Ixtahuacán', 'Santa Catarina Palopó', 'Santa Clara La Laguna', 'Santa Cruz La Laguna', 'Santa Lucía Utatlán', 'Santa María Visitación', 'Santiago Atitlán'],
  'Suchitepéquez': ['Mazatenango', 'Chicacao', 'Cuyotenango', 'Patulul', 'Pueblo Nuevo', 'Río Bravo', 'Samayac', 'San Antonio Suchitepéquez', 'San Bernardino', 'San Francisco Zapotitlán', 'San Gabriel', 'San José El Ídolo', 'San Juan Bautista', 'San Lorenzo', 'San Miguel Panán', 'San Pablo Jocopilas', 'Santa Bárbara', 'Santo Domingo Suchitepéquez', 'Santo Tomás La Unión', 'Zunilito'],
  'Totonicapán': ['Totonicapán', 'Momostenango', 'San Andrés Xecul', 'San Bartolo', 'San Cristóbal Totonicapán', 'San Francisco El Alto', 'Santa Lucía La Reforma', 'Santa María Chiquimula'],
  'Zacapa': ['Zacapa', 'Cabañas', 'Estanzuela', 'Gualán', 'Huité', 'La Unión', 'Río Hondo', 'San Diego', 'San Jorge', 'Teculután', 'Usumatlán'],
};

// Zonas para Guatemala Ciudad
export const ZONAS_GUATEMALA = Array.from({ length: 25 }, (_, i) => `Zona ${i + 1}`);

// Tipos de negocio para clientes empresariales
export const TIPOS_NEGOCIO = [
  'Restaurante',
  'Hotel',
  'Bar / Cantina',
  'Cafetería / Coffee Shop',
  'Catering / Banquetes',
  'Supermercado / Tienda',
  'Comedor',
  'Distribuidora',
  'Procesadora de alimentos',
  'Otro',
];

// Estados de orden con labels en español
export const ESTADOS_LABEL = {
  nueva:       'Nuevo',
  confirmada:  'Confirmado',
  aprobada:    'Aprobado',
  preparando:  'En preparación',
  en_ruta:     'En ruta',
  entregada:   'Entregado',
  facturada:   'Facturado',
  pagada:      'Pagado',
  cancelada:   'Cancelado',
};
