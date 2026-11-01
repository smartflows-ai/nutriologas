// src/components/legal/legalContent.ts
// Privacy notice and terms of service, in Spanish and English, for the platform (NewAigent) and for each business.
// Rules for editing this file:
// - Say what the product really does. No absolute promises ("never", "100 %", "impossible").
// - Do not hardcode prices, plan limits or provider contracts: send the reader to the pricing page.
// - Who operates NewAigent comes from src/lib/legal-entity.ts; empty fields are left out of the text.
// - Have a lawyer review changes, above all those about health data.
import { Lang } from "@/i18n/types";
import { LEGAL_ENTITY } from "@/lib/legal-entity";

export interface LegalSection {
  id: string;
  title: string;
  badge?: string;
  content: string[];
  bulletPoints?: string[];
  callout?: {
    type: "info" | "success" | "warning";
    title: string;
    text: string;
  };
}

export interface LegalDocument {
  title: string;
  subtitle: string;
  lastUpdated: string;
  effectiveDate: string;
  badge: string;
  summary: string;
  sections: LegalSection[];
}

/** Public data of a business, for its own privacy notice and terms. Undefined means the platform itself. */
export interface LegalSubject {
  name: string;
  ownerName?: string | null;
  address?: string | null;
  whatsappNumber?: string | null;
  /** The business registers health details (clinics): adds the sensitive-data section. */
  handlesHealthData?: boolean;
}

const UPDATED = {
  es: { lastUpdated: "Octubre 2026", effectiveDate: "29 de Octubre de 2026" },
  en: { lastUpdated: "October 2026", effectiveDate: "October 29, 2026" },
};

const SUPPORT_EMAIL = "soporte@newaigent.com";
const privacyEmail = () => LEGAL_ENTITY.privacyEmail.trim() || "privacidad@newaigent.com";

function isBusiness(subject?: LegalSubject): subject is LegalSubject {
  return !!subject && !!subject.name && subject.name !== "NewAigent";
}

function operatedBy(lang: Lang): string[] {
  const name = LEGAL_ENTITY.name.trim();
  if (!name) return [];
  const address = LEGAL_ENTITY.address.trim();
  return [
    lang === "es"
      ? `NewAigent es operado por ${name}${address ? `, con domicilio en ${address}` : ""}.`
      : `NewAigent is operated by ${name}${address ? `, located at ${address}` : ""}.`,
  ];
}

function retentionLine(lang: Lang): string[] {
  const retention = LEGAL_ENTITY.retention.trim();
  if (!retention) return [];
  return [lang === "es" ? `Plazo de conservación después de terminar la cuenta: ${retention}.` : `Retention after an account ends: ${retention}.`];
}

function businessContact(lang: Lang, subject: LegalSubject): string {
  const parts: string[] = [];
  if (subject.ownerName) parts.push(`${lang === "es" ? "Responsable" : "Responsible person"}: ${subject.ownerName}`);
  if (subject.address) parts.push(`${lang === "es" ? "Domicilio" : "Address"}: ${subject.address}`);
  if (subject.whatsappNumber) parts.push(`WhatsApp: ${subject.whatsappNumber}`);
  return parts.join(". ");
}

function numbered(sections: LegalSection[]): LegalSection[] {
  return sections.map((section, index) => ({ ...section, title: `${index + 1}. ${section.title}` }));
}

// ----------------------------------------------------------------------------------------------- Privacy

export function getPrivacyPolicy(lang: Lang, subject?: LegalSubject): LegalDocument {
  const business = isBusiness(subject);
  const name = business ? subject.name : "NewAigent";
  const contact = business ? businessContact(lang, subject) : "";
  const health = business ? !!subject.handlesHealthData : true;
  const updated = UPDATED[lang === "es" ? "es" : "en"];

  if (lang === "es") {
    const sections: LegalSection[] = [
      {
        id: "responsable",
        title: "Quién es responsable de tus datos",
        badge: "Responsables",
        content: business
          ? [
              `${name} es el responsable del tratamiento de los datos personales que proporcionas al comprar, agendar una cita o escribirle por WhatsApp.`,
              ...(contact ? [contact + "."] : []),
              `${name} usa la plataforma NewAigent, que actúa como encargado: trata los datos por cuenta de ${name} y conforme a sus instrucciones.`,
              "Al usar este sitio, agendar una cita o escribir por WhatsApp aceptas este aviso. Los datos sensibles se tratan solo con tu consentimiento expreso.",
            ]
          : [
              "Este aviso aplica a la plataforma NewAigent, que permite a los negocios operar su tienda, su agenda, su CRM y un asistente de mensajería.",
              ...operatedBy("es"),
              "NewAigent es responsable de los datos de las cuentas de los negocios (sus administradores) y de su facturación.",
              "Respecto de los datos de los clientes de cada negocio (citas, pedidos y conversaciones), el responsable es el negocio y NewAigent actúa como encargado: trata los datos por cuenta del negocio y conforme a sus instrucciones. Cada negocio publica su propio aviso de privacidad en su sitio.",
            ],
      },
      {
        id: "informacion-recopilada",
        title: "Datos que tratamos",
        badge: "Datos Personales",
        content: ["Tratamos solo los datos necesarios para prestar el servicio:"],
        bulletPoints: business
          ? [
              "Identidad y contacto: nombre, teléfono (WhatsApp) y correo electrónico.",
              "Citas: servicio, fecha y hora, motivo o notas que escribas, estado de la cita y registros de recordatorios y confirmaciones. En veterinarias, nombre y especie de la mascota.",
              "Conversaciones de WhatsApp: contenido de los mensajes, tu número, el nombre que muestra tu WhatsApp y la fecha y hora de cada mensaje.",
              "Pedidos: artículos, dirección de entrega, historial y estado.",
              ...(health ? ["Datos de salud: notas del profesional y respuestas a un cuestionario previo (edad, peso, estatura, alergias, medicamentos y antecedentes). Ver la sección de datos de salud."] : []),
              "Datos técnicos: dirección IP, tipo de navegador y cookies de sesión.",
            ]
          : [
              "Cuenta e identidad: nombre, correo electrónico, teléfono (WhatsApp), nombre del dueño o responsable y contraseña protegida con un hash (bcrypt).",
              "Datos del negocio: catálogo, precios, horario de atención, logo e imágenes, y la dirección del local con sus coordenadas cuando se elige con Google Maps.",
              "Datos de los clientes del negocio: nombre, teléfono y correo; citas (servicio, fecha, hora, motivo, estado, recordatorios y confirmaciones); nombre y especie de la mascota en veterinarias; pedidos y direcciones de entrega.",
              "Conversaciones de WhatsApp: contenido de los mensajes, número de teléfono, nombre que muestra WhatsApp y fecha y hora de cada mensaje.",
              "Datos de salud, solo en negocios del sector salud: notas clínicas del profesional y respuestas a un cuestionario previo (edad, peso, estatura, alergias, medicamentos y antecedentes). Ver la sección de datos de salud.",
              "Uso del servicio: cantidad de mensajes y consumo del asistente de IA para medir el plan, dirección IP, tipo de navegador y cookies de sesión.",
            ],
        callout: {
          type: "info",
          title: "No guardamos datos de tarjetas",
          text: "Nunca almacenamos números completos de tarjeta ni códigos de seguridad. Los pagos los procesan directamente las pasarelas de pago (Stripe, Conekta y PayPal).",
        },
      },
      ...(health
        ? [
            {
              id: "datos-sensibles",
              title: "Datos de salud (datos sensibles)",
              badge: "Datos Sensibles",
              content: business
                ? [
                    "Para atender tu cita podemos registrar datos de salud: el motivo de la consulta, notas del profesional y las respuestas a un cuestionario previo.",
                    "Son datos sensibles. Los tratamos solo con tu consentimiento expreso, que otorgas al marcar la casilla al agendar, y solo para atender tu cita. No los usamos para publicidad.",
                    "Puedes revocar tu consentimiento cuando quieras, como se explica en la sección de tus derechos.",
                  ]
                : [
                    "Un negocio del sector salud puede registrar datos de salud de sus pacientes. Son datos sensibles.",
                    "El negocio, como responsable, debe obtener el consentimiento expreso de sus pacientes antes de tratarlos. La plataforma incluye la casilla de consentimiento en el flujo de agendar.",
                    "NewAigent trata estos datos solo para prestar el servicio al negocio. No los usa para publicidad ni para entrenar modelos propios.",
                  ],
            },
          ]
        : []),
      {
        id: "uso-informacion",
        title: "Para qué usamos tus datos",
        badge: "Finalidades",
        content: ["Finalidades principales, necesarias para el servicio:"],
        bulletPoints: business
          ? [
              "Agendar, confirmar, reprogramar y cancelar tus citas, y procesar tus pedidos y pagos.",
              "Enviarte recordatorios y confirmaciones por WhatsApp.",
              "Responder tus mensajes por medio de un asistente automático, y pasarte con una persona cuando sea necesario.",
              "Cancelación automática: si el negocio pide confirmar la cita y no respondes antes de la hora límite que se te indica, la cita se cancela y el horario queda libre. Recibirás un aviso.",
              "Prevenir fraudes y accesos no autorizados.",
            ]
          : [
              "Crear y administrar las cuentas de los negocios, facturar y dar soporte.",
              "Operar la agenda, los recordatorios, las confirmaciones y el asistente de WhatsApp de cada negocio, y el copiloto Newy AI.",
              "Publicar en redes sociales lo que el negocio programa.",
              "Cancelación automática: cuando un negocio pide confirmar las citas, las que no se confirman antes de la hora límite se cancelan y se libera el horario, con aviso al cliente.",
              "Prevenir fraudes, accesos no autorizados y abusos de la plataforma.",
            ],
        callout: {
          type: "info",
          title: "Finalidad secundaria",
          text: `Usamos datos de forma agregada para medir y mejorar el servicio. Si no quieres que tus datos se usen para esta finalidad, escribe a ${privacyEmail()}; negarte no afecta el servicio.`,
        },
      },
      {
        id: "inteligencia-artificial",
        title: "Asistente de inteligencia artificial",
        badge: "IA",
        content: [
          business
            ? `El asistente de WhatsApp de ${name} usa modelos de lenguaje de terceros para redactar respuestas. Para responder, enviamos al proveedor el texto de la conversación y los datos del negocio que hacen falta, como servicios, precios, horarios y tus citas.`
            : "El asistente de WhatsApp y el copiloto Newy AI usan modelos de lenguaje de terceros para redactar respuestas. Para responder, enviamos al proveedor el texto de la conversación y los datos del negocio que hacen falta, como servicios, precios, horarios y las citas del cliente que escribe.",
          "Usamos modelos de pago y configuramos a nuestro proveedor de modelos para excluir a los proveedores que almacenan los mensajes o pueden usarlos para entrenar sus modelos. Aun así, cada proveedor tiene sus propios términos y no podemos garantizar que no conserve información por periodos breves por razones técnicas o legales.",
          "NewAigent no usa los datos de los clientes para entrenar modelos propios.",
          "La IA puede equivocarse. El negocio es responsable de revisar la información que publica y puede pausar el asistente para atenderte personalmente.",
          "El asistente no toma decisiones con efectos legales sobre ti, salvo la cancelación automática de una cita no confirmada, descrita en la sección de finalidades.",
          "Newy AI no recibe el texto de las conversaciones de WhatsApp ni las notas clínicas.",
        ],
      },
      {
        id: "terceros",
        title: "Proveedores y transferencias",
        badge: "Terceros",
        content: [
          "No vendemos ni rentamos datos personales. Compartimos datos con los proveedores que hacen posible el servicio:",
          "• Pagos: Stripe, Conekta y PayPal.",
          "• Alojamiento y base de datos: Vercel y Supabase (Estados Unidos).",
          "• Servidores de automatización y de conexión con WhatsApp: Amazon Web Services.",
          "• Almacenamiento de imágenes: Cloudinary.",
          "• Modelos de lenguaje: OpenRouter y los proveedores de modelos que utiliza, por ejemplo Google y OpenAI.",
          "• WhatsApp: Meta Platforms, a través del número que conecta el negocio.",
          "• Calendarios: Google Calendar y Microsoft Outlook, cuando el negocio los conecta. Se crean eventos con el nombre del cliente, el servicio, la fecha y su correo.",
          "• Búsqueda de direcciones: Google Maps, cuando se escribe una dirección.",
          "• Redes sociales: Meta (Facebook e Instagram), para las publicaciones que el negocio programa.",
          "Algunos de estos proveedores están fuera de México, principalmente en Estados Unidos. Estas transferencias son necesarias para prestar el servicio; al aceptar este aviso las consientes.",
        ],
      },
      {
        id: "seguridad",
        title: "Seguridad y separación entre negocios",
        badge: "Seguridad",
        content: [
          "Aplicamos estas medidas, sin que ningún sistema pueda ser completamente seguro:",
          "• Las contraseñas se guardan con un hash (bcrypt), nunca en texto legible.",
          "• La comunicación entre tu navegador y la plataforma usa HTTPS (TLS).",
          "• Cada negocio está separado lógicamente: las consultas a la base de datos y las herramientas del asistente se filtran por el identificador del negocio de la sesión.",
          "• Las credenciales de las integraciones (Google, Microsoft, Meta y WhatsApp) se guardan en nuestra base de datos con acceso restringido.",
          "Si ocurre una vulneración que afecte de forma significativa tus derechos, te lo informaremos.",
        ],
      },
      {
        id: "conservacion",
        title: "Conservación",
        badge: "Plazos",
        content: [
          business
            ? `${name} conserva tus datos mientras sean necesarios para las finalidades de este aviso y para cumplir obligaciones legales. Puedes pedir su eliminación como se explica en la sección de tus derechos.`
            : "Conservamos los datos mientras la cuenta esté activa y por el tiempo necesario para las finalidades de este aviso y las obligaciones legales y fiscales. Al terminar, el negocio puede pedir la entrega o la eliminación de sus datos.",
          ...retentionLine("es"),
        ],
      },
      {
        id: "cookies",
        title: "Cookies y almacenamiento local",
        badge: "Cookies",
        content: [
          "Usamos cookies y almacenamiento local solo para funciones necesarias:",
          "• Mantener tu sesión de forma segura.",
          "• Guardar el carrito de compras en tu navegador.",
          "• Recordar el tema visual y el idioma.",
          "No usamos cookies de publicidad ni redes de rastreo entre sitios.",
        ],
      },
      {
        id: "derechos-arco",
        title: "Tus derechos",
        badge: "Tus Derechos",
        content: [
          "Conforme a la legislación mexicana de protección de datos personales en posesión de los particulares, puedes:",
          "• Acceder a los datos que tenemos sobre ti.",
          "• Rectificarlos si son inexactos o están incompletos.",
          "• Cancelarlos, cuando no exista una obligación legal de conservarlos.",
          "• Oponerte a su tratamiento o revocar el consentimiento que diste, incluido el de datos sensibles.",
          business
            ? `Para ejercer estos derechos, escribe a ${name}${contact ? ` (${contact})` : ""}, o a ${privacyEmail()} si quieres que lo atienda NewAigent como encargado.`
            : `Para ejercer estos derechos escribe a ${privacyEmail()}. Si eres cliente de un negocio, también puedes dirigirte al propio negocio.`,
          "Responderemos en los plazos que marca la ley. Si consideras que tu derecho no fue atendido, puedes acudir a la autoridad de protección de datos competente.",
        ],
      },
      {
        id: "contacto",
        title: "Cambios y contacto",
        badge: "Contacto",
        content: [
          "Podemos actualizar este aviso por cambios en la ley o en el servicio. Los cambios importantes se avisan en esta página o con un aviso destacado en el panel.",
          `Para dudas sobre este aviso escribe a ${privacyEmail()} o visita https://newaigent.com.`,
        ],
      },
    ];

    return {
      title: business ? `Aviso de Privacidad de ${name}` : "Aviso de Privacidad de NewAigent",
      subtitle: business
        ? `Cómo ${name} trata tus datos personales cuando compras, agendas una cita o escribes por WhatsApp.`
        : "Qué datos trata la plataforma, para qué, con quién se comparten y cómo ejercer tus derechos.",
      lastUpdated: updated.lastUpdated,
      effectiveDate: updated.effectiveDate,
      badge: "Aviso de Privacidad",
      summary: business
        ? `Este aviso explica qué datos recibe ${name}, para qué los usa, con quién los comparte y cómo puedes ejercer tus derechos.`
        : "Este aviso explica qué datos trata NewAigent, cómo participa un asistente de inteligencia artificial, con quién compartimos información y cómo ejercer tus derechos.",
      sections: numbered(sections),
    };
  }

  // English
  const sections: LegalSection[] = [
    {
      id: "responsable",
      title: "Who is responsible for your data",
      badge: "Responsible Parties",
      content: business
        ? [
            `${name} is responsible for the personal data you provide when you buy, book an appointment or message it on WhatsApp.`,
            ...(contact ? [contact + "."] : []),
            `${name} uses the NewAigent platform, which acts as a processor: it handles the data on behalf of ${name} and under its instructions.`,
            "By using this site, booking an appointment or messaging on WhatsApp you accept this notice. Sensitive data is handled only with your express consent.",
          ]
        : [
            "This notice applies to the NewAigent platform, which lets businesses run their store, scheduling, CRM and a messaging assistant.",
            ...operatedBy("en"),
            "NewAigent is responsible for the data of business accounts (their administrators) and for billing.",
            "For the data of each business's customers (appointments, orders and conversations), the business is the responsible party and NewAigent acts as a processor: it handles the data on the business's behalf and under its instructions. Each business publishes its own privacy notice on its site.",
          ],
    },
    {
      id: "informacion-recopilada",
      title: "Data we handle",
      badge: "Personal Data",
      content: ["We handle only the data needed to provide the service:"],
      bulletPoints: business
        ? [
            "Identity and contact: name, phone (WhatsApp) and e-mail.",
            "Appointments: service, date and time, reason or notes you write, appointment status, and records of reminders and confirmations. For veterinary clinics, the pet's name and species.",
            "WhatsApp conversations: message content, your number, the name your WhatsApp shows, and the date and time of each message.",
            "Orders: items, delivery address, history and status.",
            ...(health ? ["Health data: notes from the professional and answers to an intake questionnaire (age, weight, height, allergies, medications and history). See the health data section."] : []),
            "Technical data: IP address, browser type and session cookies.",
          ]
        : [
            "Account and identity: name, e-mail, phone (WhatsApp), owner or responsible person, and a password protected with a hash (bcrypt).",
            "Business data: catalog, prices, opening hours, logo and images, and the address of the premises with its coordinates when chosen with Google Maps.",
            "Data of the business's customers: name, phone and e-mail; appointments (service, date, time, reason, status, reminders and confirmations); pet name and species at veterinary clinics; orders and delivery addresses.",
            "WhatsApp conversations: message content, phone number, the name WhatsApp shows, and the date and time of each message.",
            "Health data, only at health businesses: clinical notes from the professional and answers to an intake questionnaire (age, weight, height, allergies, medications and history). See the health data section.",
            "Service usage: message counts and AI assistant consumption to measure the plan, IP address, browser type and session cookies.",
          ],
      callout: {
        type: "info",
        title: "We do not store card data",
        text: "We never store full card numbers or security codes. Payments are processed directly by the payment gateways (Stripe, Conekta and PayPal).",
      },
    },
    ...(health
      ? [
          {
            id: "datos-sensibles",
            title: "Health data (sensitive data)",
            badge: "Sensitive Data",
            content: business
              ? [
                  "To attend your appointment we may record health data: the reason for the visit, notes from the professional and answers to an intake questionnaire.",
                  "This is sensitive data. We handle it only with your express consent, which you give by ticking the box when booking, and only to attend your appointment. We do not use it for advertising.",
                  "You can withdraw your consent at any time, as explained in the section on your rights.",
                ]
              : [
                  "A health business may record health data of its patients. This is sensitive data.",
                  "The business, as the responsible party, must obtain its patients' express consent before handling it. The platform includes the consent box in the booking flow.",
                  "NewAigent handles this data only to provide the service to the business. It does not use it for advertising or to train its own models.",
                ],
          },
        ]
      : []),
    {
      id: "uso-informacion",
      title: "What we use your data for",
      badge: "Purposes",
      content: ["Main purposes, needed for the service:"],
      bulletPoints: business
        ? [
            "Scheduling, confirming, rescheduling and cancelling your appointments, and processing your orders and payments.",
            "Sending you reminders and confirmations on WhatsApp.",
            "Answering your messages through an automated assistant, and passing you to a person when needed.",
            "Automatic cancellation: if the business asks you to confirm the appointment and you do not reply before the deadline you are given, the appointment is cancelled and the slot is freed. You will receive a notice.",
            "Preventing fraud and unauthorized access.",
          ]
        : [
            "Creating and managing business accounts, billing and support.",
            "Running each business's scheduling, reminders, confirmations and WhatsApp assistant, and the Newy AI copilot.",
            "Publishing to social networks what the business schedules.",
            "Automatic cancellation: when a business asks to confirm appointments, those not confirmed before the deadline are cancelled and the slot is freed, with a notice to the customer.",
            "Preventing fraud, unauthorized access and abuse of the platform.",
          ],
      callout: {
        type: "info",
        title: "Secondary purpose",
        text: `We use data in aggregate form to measure and improve the service. If you do not want your data used for this purpose, write to ${privacyEmail()}; refusing does not affect the service.`,
      },
    },
    {
      id: "inteligencia-artificial",
      title: "Artificial intelligence assistant",
      badge: "AI",
      content: [
        business
          ? `${name}'s WhatsApp assistant uses third-party language models to write replies. To answer, we send the provider the text of the conversation and the business data that is needed, such as services, prices, hours and your appointments.`
          : "The WhatsApp assistant and the Newy AI copilot use third-party language models to write replies. To answer, we send the provider the text of the conversation and the business data that is needed, such as services, prices, hours and the appointments of the customer who writes.",
        "We use paid models and configure our model provider to exclude providers that store messages or may use them to train their models. Even so, each provider has its own terms and we cannot guarantee that it does not keep information for short periods for technical or legal reasons.",
        "NewAigent does not use customers' data to train its own models.",
        "AI can make mistakes. The business is responsible for reviewing the information it publishes and can pause the assistant to attend to you personally.",
        "The assistant does not make decisions with legal effects on you, except the automatic cancellation of an unconfirmed appointment, described in the purposes section.",
        "Newy AI does not receive the text of WhatsApp conversations or clinical notes.",
      ],
    },
    {
      id: "terceros",
      title: "Providers and transfers",
      badge: "Third Parties",
      content: [
        "We do not sell or rent personal data. We share data with the providers that make the service possible:",
        "• Payments: Stripe, Conekta and PayPal.",
        "• Hosting and database: Vercel and Supabase (United States).",
        "• Automation servers and the WhatsApp connection: Amazon Web Services.",
        "• Image storage: Cloudinary.",
        "• Language models: OpenRouter and the model providers it uses, for example Google and OpenAI.",
        "• WhatsApp: Meta Platforms, through the number the business connects.",
        "• Calendars: Google Calendar and Microsoft Outlook, when the business connects them. Events are created with the customer's name, the service, the date and their e-mail.",
        "• Address search: Google Maps, when an address is typed.",
        "• Social networks: Meta (Facebook and Instagram), for the posts the business schedules.",
        "Some of these providers are outside Mexico, mainly in the United States. These transfers are necessary to provide the service; by accepting this notice you consent to them.",
      ],
    },
    {
      id: "seguridad",
      title: "Security and separation between businesses",
      badge: "Security",
      content: [
        "We apply these measures, although no system can be completely secure:",
        "• Passwords are stored with a hash (bcrypt), never as readable text.",
        "• Communication between your browser and the platform uses HTTPS (TLS).",
        "• Each business is logically separated: database queries and the assistant's tools are filtered by the business identifier of the session.",
        "• Integration credentials (Google, Microsoft, Meta and WhatsApp) are kept in our database with restricted access.",
        "If a breach significantly affects your rights, we will let you know.",
      ],
    },
    {
      id: "conservacion",
      title: "Retention",
      badge: "Periods",
      content: [
        business
          ? `${name} keeps your data while it is needed for the purposes of this notice and to meet legal obligations. You can ask for its deletion as explained in the section on your rights.`
          : "We keep data while the account is active and for the time needed for the purposes of this notice and for legal and tax obligations. When it ends, the business can ask for its data to be handed over or deleted.",
        ...retentionLine("en"),
      ],
    },
    {
      id: "cookies",
      title: "Cookies and local storage",
      badge: "Cookies",
      content: [
        "We use cookies and local storage only for necessary functions:",
        "• Keeping your session secure.",
        "• Saving the shopping cart in your browser.",
        "• Remembering the visual theme and the language.",
        "We do not use advertising cookies or cross-site tracking networks.",
      ],
    },
    {
      id: "derechos-arco",
      title: "Your rights",
      badge: "Your Rights",
      content: [
        "Under Mexican law on the protection of personal data held by private parties, you can:",
        "• Access the data we hold about you.",
        "• Correct it if it is inaccurate or incomplete.",
        "• Delete it, when there is no legal obligation to keep it.",
        "• Object to its processing or withdraw the consent you gave, including consent for sensitive data.",
        business
          ? `To exercise these rights, write to ${name}${contact ? ` (${contact})` : ""}, or to ${privacyEmail()} if you want NewAigent to handle it as processor.`
          : `To exercise these rights write to ${privacyEmail()}. If you are a customer of a business, you can also contact the business itself.`,
        "We will reply within the periods set by law. If you believe your right was not honored, you can go to the competent data protection authority.",
      ],
    },
    {
      id: "contacto",
      title: "Changes and contact",
      badge: "Contact",
      content: [
        "We may update this notice because of changes in the law or in the service. Important changes are announced on this page or with a prominent notice in the dashboard.",
        `For questions about this notice write to ${privacyEmail()} or visit https://newaigent.com.`,
      ],
    },
  ];

  return {
    title: business ? `${name} Privacy Notice` : "NewAigent Privacy Notice",
    subtitle: business
      ? `How ${name} handles your personal data when you buy, book an appointment or message on WhatsApp.`
      : "What data the platform handles, why, who it is shared with, and how to exercise your rights.",
    lastUpdated: updated.lastUpdated,
    effectiveDate: updated.effectiveDate,
    badge: "Privacy Notice",
    summary: business
      ? `This notice explains what data ${name} receives, why it uses it, who it shares it with and how you can exercise your rights.`
      : "This notice explains what data NewAigent handles, how an artificial intelligence assistant takes part, who we share information with and how to exercise your rights.",
    sections: numbered(sections),
  };
}

// ----------------------------------------------------------------------------------------------- Terms

export function getTermsOfService(lang: Lang, subject?: LegalSubject): LegalDocument {
  const business = isBusiness(subject);
  const name = business ? subject.name : "NewAigent";
  const health = business ? !!subject.handlesHealthData : false;
  const updated = UPDATED[lang === "es" ? "es" : "en"];
  const jurisdiction = LEGAL_ENTITY.jurisdiction.trim();

  if (lang === "es") {
    const sections: LegalSection[] = [
      {
        id: "aceptacion",
        title: "Aceptación de los términos",
        badge: "Vinculación Legal",
        content: [
          `Al crear una cuenta, comprar, agendar una cita o usar las herramientas de ${name}, aceptas estos Términos de Servicio y el Aviso de Privacidad.`,
          "Si no estás de acuerdo con alguna parte, no uses el servicio.",
          "Debes tener capacidad legal para contratar conforme a la ley que te aplique.",
          ...(business ? [] : operatedBy("es")),
        ],
      },
      business
        ? {
            id: "cuentas-acceso",
            title: "Tu cuenta",
            badge: "Cuentas",
            content: [
              "Si creas una cuenta en este sitio, eres responsable de guardar tu contraseña y de lo que se haga con ella.",
              "Debes darnos datos verdaderos y actualizados.",
              `Si notas un uso no autorizado de tu cuenta, avísanos de inmediato por el medio de contacto de ${name}.`,
            ],
          }
        : {
            id: "cuentas-acceso",
            title: "Cuentas de negocio y subdominios",
            badge: "Cuentas",
            content: [
              "Cada negocio crea un subdominio propio (por ejemplo, clinica.newaigent.com) y credenciales de administrador.",
              "• Contraseñas: eres responsable de guardarlas y de todo lo que se haga con tu cuenta.",
              `• Avisos de seguridad: informa de inmediato cualquier uso no autorizado a ${SUPPORT_EMAIL}.`,
              "• Datos verdaderos: debes dar información verídica y vigente al registrar tu negocio y tus datos de facturación.",
            ],
          },
      business
        ? {
            id: "suscripciones-facturacion",
            title: "Compras y pagos",
            badge: "Pagos",
            content: [
              `Las compras de productos o servicios en ${name} se hacen al precio que se muestra al confirmar el pedido.`,
              "Los pagos se procesan de forma segura con tarjeta (Conekta o Stripe), OXXO Pay o PayPal. Al confirmar, autorizas el cobro del monto indicado.",
              "Los precios se muestran en la moneda del pago e indican si incluyen impuestos.",
            ],
          }
        : {
            id: "suscripciones-facturacion",
            title: "Planes, precios y facturación",
            badge: "Suscripciones",
            content: [
              "NewAigent ofrece planes de suscripción mensual en pesos mexicanos. Los planes vigentes, su precio, lo que incluye cada uno y la cantidad de conversaciones al mes se muestran en la página de precios al contratar.",
              "• Cobro: la suscripción se cobra con Stripe. Los precios indican si incluyen IVA.",
              "• Renovación automática: la suscripción se renueva al inicio de cada periodo, salvo que canceles antes de la fecha de corte.",
              "• Cancelación: puedes cancelar cuando quieras desde el panel. Tu acceso sigue activo hasta el final del periodo ya pagado.",
              "• Pago único de alta: algunos planes pueden incluir un cobro único de implementación (conexión de WhatsApp, carga de catálogo y calendario). Se muestra antes de pagar, junto con sus condiciones de reembolso.",
              "• Prueba: si ofrecemos un periodo de prueba, se informa su duración y lo que incluye.",
            ],
          },
      business
        ? {
            id: "asistente-ia",
            title: "Asistente virtual",
            badge: "Asistente IA",
            content: [
              `${name} usa un asistente automático con inteligencia artificial para responder mensajes y agendar citas.`,
              "• Puede equivocarse. Confirma con el negocio los datos importantes, como precios, horarios y políticas.",
              "• Puedes pedir hablar con una persona del negocio en cualquier momento.",
              ...(health ? ["• No sustituye la consulta ni el consejo de un profesional de la salud. En una urgencia, acude a un servicio de emergencias."] : []),
            ],
          }
        : {
            id: "asistente-ia",
            title: "Asistente de IA y límites de uso",
            badge: "Asistente IA",
            content: [
              "El asistente de WhatsApp y Newy AI usan modelos de lenguaje. Pueden cometer errores: eres responsable de revisar la información que publicas (precios, horarios, políticas) y de atender a tus clientes cuando el asistente no pueda.",
              "• Límite del plan: cada plan incluye una cantidad de conversaciones al mes. Al alcanzarla, el asistente puede pausarse hasta el siguiente periodo o hasta que amplíes tu plan. Las condiciones de excedentes se informan en la página de precios.",
              "• Pausa protectora: cuando se agota el consumo incluido, las campañas y automatizaciones relacionadas se pausan para evitar cargos no autorizados.",
              "• El asistente no sustituye consejo médico, legal ni financiero.",
            ],
            callout: {
              type: "info",
              title: "Continuidad del servicio",
              text: "Procuramos mantener el asistente disponible usando modelos de respaldo, pero no garantizamos una disponibilidad continua.",
            },
          },
      business
        ? {
            id: "citas-confirmacion",
            title: "Citas, recordatorios y confirmación",
            badge: "Citas",
            content: [
              "Al agendar autorizas que te enviemos recordatorios y confirmaciones por WhatsApp.",
              "Si el negocio pide confirmar la cita, debes responder SI antes de la hora límite que se te indica en el mensaje.",
              "Si no confirmas a tiempo, la cita se cancela automáticamente y el horario queda libre. Recibirás un aviso y podrás agendar de nuevo.",
              "Puedes reprogramar o cancelar tu cita respondiendo al mensaje o escribiendo al negocio.",
            ],
          }
        : {
            id: "obligaciones-negocio",
            title: "Obligaciones del negocio",
            badge: "Tus Obligaciones",
            content: [
              "• Datos de tus clientes: eres el responsable. Debes tener tu propio aviso de privacidad y, para datos de salud, el consentimiento expreso de tus pacientes. La plataforma incluye el aviso y la casilla de consentimiento en el flujo de agendar.",
              "• Mensajes: debes contar con el consentimiento de tus clientes para enviarles recordatorios y mensajes por WhatsApp.",
              "• Contenido: eres responsable de lo que publicas y de lo que prometes a tus clientes.",
              "• NewAigent actúa como encargado: trata los datos por tu cuenta y conforme a tus instrucciones, según el Aviso de Privacidad.",
              "• Citas: si activas la confirmación, las citas no confirmadas a tiempo se cancelan automáticamente. Tú defines los tiempos en el panel.",
            ],
          },
      ...(business
        ? []
        : [
            {
              id: "whatsapp",
              title: "Canal de WhatsApp",
              badge: "WhatsApp",
              content: [
                "El asistente usa WhatsApp, que pertenece a Meta y tiene sus propias reglas.",
                "• Meta puede limitar o suspender un número si considera que se incumplen sus políticas. NewAigent no controla esa decisión.",
                "• No garantizamos la entrega de los mensajes ni la continuidad del número del negocio.",
                "• Eres responsable de usar tu número de acuerdo con las políticas de WhatsApp.",
              ],
            },
          ]),
      {
        id: "comercio-pedidos",
        title: "Comercio electrónico y cumplimiento",
        badge: "E-Commerce",
        content: [
          "En las compras dentro de la tienda de un negocio:",
          `• El negocio (${business ? name : "cada negocio titular"}) es quien vende y responde por la calidad, la garantía y la entrega de sus productos y servicios.`,
          "• NewAigent provee la tecnología y no responde por retrasos de paqueterías, faltantes de inventario ni disputas comerciales entre compradores y negocios.",
          "• Las cancelaciones y los reembolsos siguen la política de cada tienda.",
        ],
      },
      {
        id: "uso-aceptable",
        title: "Uso aceptable",
        badge: "Conducta",
        content: [
          "Al usar el servicio te comprometes a no:",
          "• Vender productos ilegales, medicamentos controlados sin receta, armas o material que infrinja derechos de propiedad intelectual.",
          "• Enviar spam o mensajes no solicitados, ni violar las políticas de Meta o de WhatsApp.",
          "• Intentar inyecciones de instrucciones, jailbreak o ingeniería inversa contra el asistente o las APIs.",
          "• Intentar saltarte la separación entre negocios para ver datos de otros.",
          "Si lo incumples, podemos suspender o cancelar la cuenta sin derecho a reembolso.",
        ],
      },
      {
        id: "propiedad-intelectual",
        title: "Propiedad intelectual",
        badge: "Derechos de Autor",
        content: [
          "• Marca y datos del negocio: el titular conserva sus marcas, logotipos, fotos y los datos de sus clientes.",
          "• Plataforma: NewAigent conserva los derechos sobre el software, las interfaces, el código y la marca Newy AI.",
          business ? "• Se te permite usar este sitio solo para los fines normales de compra y agenda." : "• Mientras tu suscripción esté vigente, tienes una licencia limitada, no exclusiva, intransferible y revocable para usar el software.",
        ],
      },
      {
        id: "garantias-responsabilidad",
        title: "Disponibilidad y responsabilidad",
        badge: "Límites",
        content: [
          "Prestamos el servicio con nuestro mejor esfuerzo técnico, sin garantizar que esté disponible de forma continua ni sin errores.",
          "El servicio se ofrece \"tal cual\" y \"según disponibilidad\". En la medida que permita la ley, no respondemos por daños indirectos, pérdida de ingresos ni interrupciones causadas por terceros (Meta, WhatsApp, Google, proveedores de modelos o pasarelas de pago).",
          "Nuestra responsabilidad total frente a ti por cualquier reclamación no excederá lo que hayas pagado en los últimos 3 meses de servicio.",
        ],
      },
      ...(business
        ? []
        : [
            {
              id: "terminacion",
              title: "Terminación y tus datos",
              badge: "Terminación",
              content: [
                "Puedes terminar el servicio cuando quieras. También podemos suspenderlo si incumples estos términos.",
                "Al terminar, puedes pedir la entrega o la eliminación de los datos de tu negocio, conforme al Aviso de Privacidad.",
              ],
            },
          ]),
      {
        id: "jurisdiccion",
        title: "Ley aplicable y disputas",
        badge: "Jurisdicción",
        content: [
          "Estos términos se rigen por las leyes de los Estados Unidos Mexicanos.",
          "Cualquier controversia se intentará resolver primero con una mediación de buena fe. Si no hay acuerdo en 30 días naturales, las partes se someten a los tribunales competentes" +
            (jurisdiction ? ` de ${jurisdiction}.` : " del domicilio de la empresa operadora."),
        ],
      },
    ];

    return {
      title: business ? `Términos de Servicio de ${name}` : "Términos de Servicio de NewAigent",
      subtitle: business
        ? `Condiciones para comprar, agendar citas y usar el sitio y el asistente de ${name}.`
        : "Condiciones para usar la plataforma, el asistente de WhatsApp y Newy AI.",
      lastUpdated: updated.lastUpdated,
      effectiveDate: updated.effectiveDate,
      badge: "Acuerdo Legal",
      summary: business
        ? `Al comprar, agendar una cita o escribir a ${name}, aceptas las condiciones que se explican aquí.`
        : "Estos términos regulan el uso de la plataforma NewAigent: tienda, agenda, CRM, asistente de WhatsApp y Newy AI.",
      sections: numbered(sections),
    };
  }

  // English
  const sections: LegalSection[] = [
    {
      id: "aceptacion",
      title: "Acceptance of terms",
      badge: "Binding Agreement",
      content: [
        `By creating an account, buying, booking an appointment or using the tools of ${name}, you accept these Terms of Service and the Privacy Notice.`,
        "If you do not agree with any part, do not use the service.",
        "You must have the legal capacity to contract under the law that applies to you.",
        ...(business ? [] : operatedBy("en")),
      ],
    },
    business
      ? {
          id: "cuentas-acceso",
          title: "Your account",
          badge: "Accounts",
          content: [
            "If you create an account on this site, you are responsible for keeping your password safe and for what is done with it.",
            "You must give us true and up-to-date data.",
            `If you notice unauthorized use of your account, tell us right away through ${name}'s contact details.`,
          ],
        }
      : {
          id: "cuentas-acceso",
          title: "Business accounts and subdomains",
          badge: "Accounts",
          content: [
            "Each business creates its own subdomain (for example, clinic.newaigent.com) and administrator credentials.",
            "• Passwords: you are responsible for keeping them safe and for everything done with your account.",
            `• Security notices: report any unauthorized use right away to ${SUPPORT_EMAIL}.`,
            "• True data: you must give accurate and current information when registering your business and billing details.",
          ],
        },
    business
      ? {
          id: "suscripciones-facturacion",
          title: "Purchases and payments",
          badge: "Payments",
          content: [
            `Purchases of products or services at ${name} are made at the price shown when you confirm the order.`,
            "Payments are processed securely by card (Conekta or Stripe), OXXO Pay or PayPal. By confirming, you authorize the charge of the stated amount.",
            "Prices are shown in the payment currency and say whether they include taxes.",
          ],
        }
      : {
          id: "suscripciones-facturacion",
          title: "Plans, prices and billing",
          badge: "Subscriptions",
          content: [
            "NewAigent offers monthly subscription plans in Mexican pesos. The current plans, their price, what each includes and the number of conversations per month are shown on the pricing page when you subscribe.",
            "• Billing: the subscription is charged through Stripe. Prices say whether they include VAT.",
            "• Automatic renewal: the subscription renews at the start of each period unless you cancel before the cutoff date.",
            "• Cancellation: you can cancel at any time from the dashboard. Your access stays active until the end of the period you already paid.",
            "• One-time setup fee: some plans may include a one-time implementation charge (WhatsApp connection, catalog and calendar setup). It is shown before you pay, together with its refund conditions.",
            "• Trial: if we offer a trial period, its length and what it includes are stated.",
          ],
        },
    business
      ? {
          id: "asistente-ia",
          title: "Virtual assistant",
          badge: "AI Assistant",
          content: [
            `${name} uses an automated assistant with artificial intelligence to answer messages and book appointments.`,
            "• It can make mistakes. Confirm important details with the business, such as prices, hours and policies.",
            "• You can ask to speak with a person at the business at any time.",
            ...(health ? ["• It does not replace a visit or the advice of a health professional. In an emergency, go to an emergency service."] : []),
          ],
        }
      : {
          id: "asistente-ia",
          title: "AI assistant and usage limits",
          badge: "AI Assistant",
          content: [
            "The WhatsApp assistant and Newy AI use language models. They can make mistakes: you are responsible for reviewing the information you publish (prices, hours, policies) and for attending to your customers when the assistant cannot.",
            "• Plan limit: each plan includes a number of conversations per month. When it is reached, the assistant may pause until the next period or until you upgrade your plan. The conditions for extra usage are stated on the pricing page.",
            "• Protective pause: when the included usage runs out, related campaigns and automations pause to avoid unauthorized charges.",
            "• The assistant does not replace medical, legal or financial advice.",
          ],
          callout: {
            type: "info",
            title: "Service continuity",
            text: "We try to keep the assistant available by using backup models, but we do not guarantee continuous availability.",
          },
        },
    business
      ? {
          id: "citas-confirmacion",
          title: "Appointments, reminders and confirmation",
          badge: "Appointments",
          content: [
            "By booking you authorize us to send you reminders and confirmations on WhatsApp.",
            "If the business asks you to confirm the appointment, you must reply YES (SI) before the deadline given in the message.",
            "If you do not confirm in time, the appointment is cancelled automatically and the slot is freed. You will receive a notice and can book again.",
            "You can reschedule or cancel your appointment by replying to the message or writing to the business.",
          ],
        }
      : {
          id: "obligaciones-negocio",
          title: "Business obligations",
          badge: "Your Obligations",
          content: [
            "• Your customers' data: you are the responsible party. You must have your own privacy notice and, for health data, your patients' express consent. The platform includes the notice and the consent box in the booking flow.",
            "• Messages: you must have your customers' consent to send them reminders and WhatsApp messages.",
            "• Content: you are responsible for what you publish and for what you promise your customers.",
            "• NewAigent acts as a processor: it handles the data on your behalf and under your instructions, as set out in the Privacy Notice.",
            "• Appointments: if you turn on confirmation, appointments not confirmed in time are cancelled automatically. You set the times in the dashboard.",
          ],
        },
    ...(business
      ? []
      : [
          {
            id: "whatsapp",
            title: "WhatsApp channel",
            badge: "WhatsApp",
            content: [
              "The assistant uses WhatsApp, which belongs to Meta and has its own rules.",
              "• Meta may limit or suspend a number if it considers its policies are not followed. NewAigent does not control that decision.",
              "• We do not guarantee message delivery or the continuity of the business's number.",
              "• You are responsible for using your number in line with WhatsApp's policies.",
            ],
          },
        ]),
    {
      id: "comercio-pedidos",
      title: "E-commerce and fulfillment",
      badge: "E-Commerce",
      content: [
        "For purchases inside a business's store:",
        `• The business (${business ? name : "each independent business"}) is the seller and is responsible for the quality, warranty and delivery of its products and services.`,
        "• NewAigent provides the technology and is not responsible for courier delays, stock shortages or commercial disputes between buyers and businesses.",
        "• Cancellations and refunds follow each store's policy.",
      ],
    },
    {
      id: "uso-aceptable",
      title: "Acceptable use",
      badge: "Conduct",
      content: [
        "By using the service you agree not to:",
        "• Sell illegal goods, controlled medicines without a prescription, weapons or material that infringes intellectual property rights.",
        "• Send spam or unsolicited messages, or violate Meta or WhatsApp policies.",
        "• Attempt prompt injection, jailbreaks or reverse engineering against the assistant or the APIs.",
        "• Try to get around the separation between businesses to see other businesses' data.",
        "If you break these rules, we may suspend or cancel the account without a refund.",
      ],
    },
    {
      id: "propiedad-intelectual",
      title: "Intellectual property",
      badge: "Copyright",
      content: [
        "• Business brand and data: the owner keeps its trademarks, logos, photos and its customers' data.",
        "• Platform: NewAigent keeps the rights to the software, interfaces, code and the Newy AI trademark.",
        business ? "• You may use this site only for ordinary shopping and booking." : "• While your subscription is in force, you have a limited, non-exclusive, non-transferable and revocable license to use the software.",
      ],
    },
    {
      id: "garantias-responsabilidad",
      title: "Availability and liability",
      badge: "Limits",
      content: [
        "We provide the service with our best technical effort, without guaranteeing that it will be available continuously or error free.",
        "The service is provided \"as is\" and \"as available\". To the extent the law allows, we are not liable for indirect damages, lost revenue or interruptions caused by third parties (Meta, WhatsApp, Google, model providers or payment gateways).",
        "Our total liability to you for any claim will not exceed what you paid in the last 3 months of service.",
      ],
    },
    ...(business
      ? []
      : [
          {
            id: "terminacion",
            title: "Termination and your data",
            badge: "Termination",
            content: [
              "You can end the service at any time. We may also suspend it if you break these terms.",
              "When it ends, you can ask for your business data to be handed over or deleted, as set out in the Privacy Notice.",
            ],
          },
        ]),
    {
      id: "jurisdiccion",
      title: "Governing law and disputes",
      badge: "Jurisdiction",
      content: [
        "These terms are governed by the laws of the United Mexican States.",
        "Any dispute will first be addressed through good-faith mediation. If there is no agreement within 30 calendar days, the parties submit to the competent courts" +
          (jurisdiction ? ` of ${jurisdiction}.` : " of the operating company's address."),
      ],
    },
  ];

  return {
    title: business ? `${name} Terms of Service` : "NewAigent Terms of Service",
    subtitle: business
      ? `Conditions for buying, booking appointments and using the site and the assistant of ${name}.`
      : "Conditions for using the platform, the WhatsApp assistant and Newy AI.",
    lastUpdated: updated.lastUpdated,
    effectiveDate: updated.effectiveDate,
    badge: "Terms Agreement",
    summary: business
      ? `By buying, booking an appointment or writing to ${name}, you accept the conditions explained here.`
      : "These terms govern the use of the NewAigent platform: store, scheduling, CRM, WhatsApp assistant and Newy AI.",
    sections: numbered(sections),
  };
}
