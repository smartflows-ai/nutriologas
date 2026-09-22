// src/components/legal/legalContent.ts
import { Lang } from "@/i18n/types";

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

export function getPrivacyPolicy(lang: Lang, tenantName?: string): LegalDocument {
  const isTenant = !!tenantName && tenantName !== "NewAigent";
  const entityName = isTenant ? tenantName : "NewAigent";

  if (lang === "es") {
    return {
      title: isTenant ? `Política de Privacidad de ${tenantName}` : "Política de Privacidad de NewAigent",
      subtitle: isTenant
        ? `Protección de datos y transparencia en el uso de información para clientes y usuarios de ${tenantName}.`
        : "Compromiso absoluto con la seguridad, el aislamiento multitenant y la privacidad de tus datos de negocio.",
      lastUpdated: "Septiembre 2026",
      effectiveDate: "1 de Septiembre de 2026",
      badge: "Transparencia & Seguridad",
      summary: isTenant
        ? `En ${tenantName}, valoramos tu confianza y nos comprometemos a proteger tu información personal y los datos de tus compras, citas y consultas con los más altos estándares de seguridad.`
        : "En NewAigent creemos que tus datos comerciales son tu activo más valioso. Esta política detalla cómo recopilamos, procesamos y protegemos la información en nuestra plataforma SaaS multitenant y servicios de copiloto IA.",
      sections: [
        {
          id: "introduccion",
          title: "1. Introducción y Alcance",
          badge: "Ámbito Legal",
          content: [
            `La presente Política de Privacidad establece los términos bajo los cuales ${entityName} recopila, utiliza, protege y divulga la información proporcionada por usuarios, clientes y administradores.`,
            isTenant
              ? `${tenantName} opera su tienda y canal digital mediante la infraestructura tecnológica de NewAigent como proveedor de software. Ambas entidades cooperan para salvaguardar tu privacidad.`
              : "NewAigent es una plataforma de automatización comercial multi-tenant que permite a negocios operar tiendas digitales, CRM, mensajería inteligente y flujos de redes sociales de forma aislada.",
            "Al acceder a este sitio web, registrarte o contratar servicios, manifiestas tu consentimiento expreso con las prácticas de recopilación y uso de información descritas en este documento.",
          ],
        },
        {
          id: "informacion-recopilada",
          title: "2. Información que Recopilamos",
          badge: "Datos Personales",
          content: [
            "Recopilamos únicamente la información necesaria para proporcionar una experiencia de servicio óptima, segura y personalizada:",
          ],
          bulletPoints: [
            "Datos de Cuenta e Identidad: Nombre completo, correo electrónico, número de teléfono (WhatsApp) y contraseñas cifradas con hash criptográfico (bcrypt).",
            "Datos Comerciales y de Negocio: Catálogo de productos, servicios, precios, descripciones de negocio, horarios de atención e imágenes alojadas.",
            "Información de Compras y Pedidos: Artículos adquiridos, dirección de entrega física, historial de pedidos y estado de cumplimiento.",
            "Registros de Mensajería: Consultas enviadas a través de WhatsApp o del widget de chat de la tienda para atención al cliente y seguimiento de cotizaciones.",
            "Metadatos de Navegación y Sesión: Dirección IP, identificador de dispositivo, tipo de navegador y cookies estrictamente necesarias para autenticación.",
          ],
          callout: {
            type: "info",
            title: "Cero Almacenamiento de Tarjetas",
            text: "Nunca almacenamos números completos de tarjetas de crédito o débito ni códigos CVV en nuestras bases de datos. Todos los pagos son tokenizados directamente por pasarelas certificadas PCI-DSS Nivel 1 (Stripe, Conekta, PayPal).",
          },
        },
        {
          id: "uso-informacion",
          title: "3. Finalidad del Tratamiento de Datos",
          badge: "Operación & CRM",
          content: [
            "La información recopilada se utiliza exclusivamente para fines operativos legítimos y acordados contractualmente:",
          ],
          bulletPoints: [
            "Procesamiento y entrega de pedidos en línea, citas médicas o de consultoría y confirmaciones de pago.",
            "Operación del Asistente Empresarial Newy AI para responder dudas de clientes y brindar analíticas al administrador del negocio.",
            "Automatización de publicaciones en redes sociales (Facebook e Instagram) previamente configuradas por el negocio.",
            "Notificaciones transaccionales vía WhatsApp o correo electrónico sobre el estado de órdenes y recordatorios de citas.",
            "Detección y prevención de fraudes, accesos no autorizados y abusos a la infraestructura de la plataforma.",
          ],
        },
        {
          id: "inteligencia-artificial",
          title: "4. Política de Privacidad de Inteligencia Artificial (Newy AI)",
          badge: "Protección IA",
          content: [
            "Entendemos la sensibilidad de los datos de negocio cuando se interactúa con modelos de lenguaje. Nuestra arquitectura implementa salvaguardas estrictas:",
            "• Cero Entrenamiento con Datos del Negocio: Los datos de tus clientes, catálogos, pedidos y conversaciones NUNCA se utilizan para entrenar o ajustar modelos fundacionales públicos de IA.",
            "• Ejecución Efímera en Memoria: Las peticiones analíticas enviadas a Newy AI se procesan en tiempo de ejecución en sesiones aisladas y no persisten en servidores de terceros.",
            "• Aislamiento por Tenant: Cada herramienta interna ejecutada por Newy AI valida estrictamente el identificador de negocio (tenantId) obtenido desde la sesión criptográfica JWT, imposibilitando el acceso cruzado entre distintas organizaciones.",
          ],
          callout: {
            type: "success",
            title: "Garantía de Soberanía de Datos",
            text: "Tus datos comerciales pertenecen exclusivamente a tu negocio. Ningún otro comercio en NewAigent puede visualizar o inferir información de tus ventas o clientes.",
          },
        },
        {
          id: "aislamiento-seguridad",
          title: "5. Aislamiento Multi-Tenant y Seguridad de la Información",
          badge: "Cifrado & Cloud",
          content: [
            "La plataforma NewAigent utiliza un modelo arquitectónico de partición lógica estricta:",
            "• Cada registro en la base de datos PostgreSQL está vinculado de forma inmutable a un tenantId verificado por middleware a nivel de servidor.",
            "• Las comunicaciones entre navegadores y servidores están cifradas de extremo a extremo mediante protocolos TLS 1.3 con certificados SSL de grado bancario.",
            "• Las credenciales de integraciones externas (tokens de Meta, Google Calendar, WhatsApp) se almacenan cifradas en reposo.",
          ],
        },
        {
          id: "terceros",
          title: "6. Proveedores de Servicios y Transferencias a Terceros",
          badge: "Integraciones",
          content: [
            "No vendemos, rentamos ni comercializamos listas de datos personales con terceros bajo ningún concepto. Compartimos datos únicamente con proveedores de infraestructura esenciales:",
            "• Pasarelas de Pago: Stripe Inc., Conekta y PayPal Holdings para procesar cobros y gestionar suscripciones.",
            "• Alojamiento en la Nube y Base de Datos: Supabase / PostgreSQL y Vercel Inc. para disponibilidad y redundancia de datos.",
            "• Almacenamiento Multimedia: Cloudinary Ltd. para entrega optimizada y segura de imágenes de productos y logos.",
            "• Mensajería y Redes Sociales: Meta Platforms Inc. (Facebook/Instagram Graph API) y servicios certificados de WhatsApp para el envío de notificaciones solicitadas.",
          ],
        },
        {
          id: "cookies",
          title: "7. Uso de Cookies y Almacenamiento Local",
          badge: "Cookies",
          content: [
            "Utilizamos cookies y almacenamiento local (localStorage) únicamente para funciones operativas indispensables:",
            "• Mantenimiento seguro de la sesión de usuario (NextAuth JWT session cookie).",
            "• Persistencia del carrito de compras local para evitar la pérdida de artículos seleccionados.",
            "• Recordación del tema visual o preferencia de idioma del navegador.",
            "No utilizamos cookies de seguimiento publicitario invasivo ni redes de rastreo de terceros entre dominios no relacionados.",
          ],
        },
        {
          id: "derechos-arco",
          title: "8. Derechos del Titular (Acceso, Rectificación, Cancelación y Oposición)",
          badge: "Tus Derechos",
          content: [
            "Conforme a las leyes internacionales de protección de datos (incluyendo el RGPD europeo, CCPA de California y la Ley Federal de Protección de Datos Personales en Posesión de los Particulares en México), tienes derecho a:",
            "• Acceder a los datos personales que conservamos sobre ti.",
            "• Rectificar información inexacta, desactualizada o incompleta.",
            "• Solicitar la eliminación definitiva de tu cuenta y datos personales cuando no existan obligaciones legales o fiscales vigentes.",
            "• Oponerte o revocar el consentimiento previamente otorgado para el tratamiento de tus datos.",
            "Para ejercer cualquiera de estos derechos, basta con enviar una solicitud a nuestro canal de soporte en soporte@newaigent.com o directamente al administrador del comercio correspondiente.",
          ],
        },
        {
          id: "contacto",
          title: "9. Modificaciones y Contacto",
          badge: "Contacto",
          content: [
            "Nos reservamos el derecho de actualizar esta Política de Privacidad para reflejar cambios normativos o mejoras en nuestras funcionalidades. Toda modificación sustancial será notificada en esta página o mediante aviso destacado en el panel de control.",
            `Para cualquier duda o aclaración respecto a esta política, puedes contactarnos a través de privacidad@newaigent.com o mediante nuestro portal en https://newaigent.com.`,
          ],
        },
      ],
    };
  }

  // English version
  return {
    title: isTenant ? `${tenantName} Privacy Policy` : "NewAigent Privacy Policy",
    subtitle: isTenant
      ? `Data protection, transparency, and trust for all customers and visitors of ${tenantName}.`
      : "Our absolute commitment to enterprise security, multi-tenant isolation, and data privacy.",
    lastUpdated: "September 2026",
    effectiveDate: "September 1, 2026",
    badge: "Trust & Security",
    summary: isTenant
      ? `At ${tenantName}, we take your privacy and personal data seriously. This document outlines how we collect, use, and protect your information across our store, orders, and communications.`
      : "At NewAigent, we believe your business data is your most valuable asset. This policy details how we collect, process, and safeguard information across our multi-tenant SaaS platform and Newy AI copilot services.",
    sections: [
      {
        id: "introduccion",
        title: "1. Introduction & Scope",
        badge: "Legal Scope",
        content: [
          `This Privacy Policy outlines how ${entityName} collects, uses, protects, and discloses personal and commercial information collected through our web applications, portals, and APIs.`,
          isTenant
            ? `${tenantName} operates its storefront and digital presence using NewAigent's enterprise cloud infrastructure. Both entities coordinate to uphold rigorous data protection standards.`
            : "NewAigent is a multi-tenant business automation platform that enables businesses to run digital storefronts, CRM systems, AI copilots, and scheduled social campaigns on fully isolated infrastructure.",
          "By accessing or using our websites, purchasing products, or using platform features, you acknowledge and agree to the data practices described herein.",
        ],
      },
      {
        id: "informacion-recopilada",
        title: "2. Information We Collect",
        badge: "Data Categories",
        content: [
          "We collect only the data necessary to provide reliable, performant, and personalized business solutions:",
        ],
        bulletPoints: [
          "Identity & Authentication Data: Full name, email address, phone number (WhatsApp), and passwords secured with cryptographic hashing (bcrypt).",
          "Business & Storefront Information: Product catalog, SKU details, pricing, appointment slots, business bios, and uploaded brand assets.",
          "Order & E-Commerce Transactions: Items purchased, fulfillment details, physical shipping destinations, and order history.",
          "Customer Communications: Inquiries and messages exchanged through WhatsApp or the web storefront chat for order tracking and customer support.",
          "Technical & Session Metadata: IP address, device fingerprints, browser telemetry, and essential authentication cookies.",
        ],
        callout: {
          type: "info",
          title: "Zero Raw Card Storage",
          text: "We never store raw credit card numbers or CVV security codes on our servers. All financial transactions are tokenized and processed directly by certified PCI-DSS Level 1 payment processors (Stripe, Conekta, PayPal).",
        },
      },
      {
        id: "uso-informacion",
        title: "3. How We Use Your Information",
        badge: "Purpose of Processing",
        content: [
          "Information collected is utilized exclusively for legitimate business purposes and contractual service execution:",
        ],
        bulletPoints: [
          "Processing, fulfilling, and shipping storefront orders, as well as scheduling client consultations.",
          "Powering Newy AI Copilot insights, inventory queries, and CRM triage actions for business owners.",
          "Publishing automated social media campaigns to authorized Facebook and Instagram pages.",
          "Transmitting transactional confirmations, shipping updates, and booking notifications via WhatsApp or email.",
          "Detecting fraudulent activities, preventing unauthorized access, and maintaining infrastructure reliability.",
        ],
      },
      {
        id: "inteligencia-artificial",
        title: "4. Artificial Intelligence & Newy AI Privacy Guarantees",
        badge: "AI Protection",
        content: [
          "We implement stringent privacy guardrails when interfacing with large language models through our Newy AI cascade:",
          "• Zero Public Model Training: Your customer records, catalogs, sales figures, and chat prompts are NEVER used to train, retrain, or fine-tune public foundation models.",
          "• Ephemeral Memory Processing: AI inference requests are processed in real-time within encrypted, ephemeral execution sessions with zero external data retention.",
          "• Strict Tenant Isolation: Every tool execution invoked by Newy AI validates the caller's tenantId extracted from verified NextAuth session tokens, preventing cross-tenant leakage.",
        ],
        callout: {
          type: "success",
          title: "Data Sovereignty Commitment",
          text: "Your commercial data remains 100% your property. No other tenant or third party on the platform can inspect, query, or infer information from your workspace.",
        },
      },
      {
        id: "aislamiento-seguridad",
        title: "5. Multi-Tenant Isolation & Data Security",
        badge: "Security & Encryption",
        content: [
          "The platform enforces strict logical partitioning throughout the tech stack:",
          "• Every database record is cryptographically tied to a validated tenantId enforced at middleware and query level.",
          "• All web traffic is encrypted in transit using industry-standard TLS 1.3 encryption with high-assurance SSL certificates.",
          "• External API tokens (Meta Graph API, Google Calendar, WhatsApp) are stored encrypted at rest.",
        ],
      },
      {
        id: "terceros",
        title: "6. Third-Party Service Providers",
        badge: "Service Partners",
        content: [
          "We never sell, monetize, or rent personal data to third-party data brokers. We share information only with authorized infrastructure vendors:",
          "• Payment Gateways: Stripe Inc., Conekta, and PayPal Holdings for subscription billing and e-commerce checkout.",
          "• Cloud Hosting & Database: Supabase / PostgreSQL and Vercel Inc. for enterprise-grade redundancy and hosting.",
          "• Media CDN: Cloudinary Ltd. for fast and secure product image optimization and asset hosting.",
          "• Social & Messaging APIs: Meta Platforms Inc. (Facebook/Instagram Graph API) and WhatsApp Cloud infrastructure for authorized communications.",
        ],
      },
      {
        id: "cookies",
        title: "7. Cookies & Local Storage",
        badge: "Cookies Policy",
        content: [
          "We utilize minimal, non-intrusive cookies and browser storage strictly for necessary operational functionality:",
          "• Secure session management cookies (NextAuth JWT) ensuring authenticated dashboard access.",
          "• Local storage for shopping cart persistence to prevent loss of customer selections during browsing.",
          "• User language preference and accessibility themes.",
          "We do not employ cross-site tracking cookies or behavioral advertising trackers.",
        ],
      },
      {
        id: "derechos-arco",
        title: "8. User Rights & Data Protection (GDPR / CCPA / LFPDPPP)",
        badge: "Your Rights",
        content: [
          "In compliance with international data privacy frameworks (including EU GDPR, California CCPA, and Mexican privacy statutes), you possess the right to:",
          "• Access and review the personal data retained about you.",
          "• Rectify inaccurate, outdated, or incomplete personal details.",
          "• Request the permanent deletion of your profile and data when legal retention obligations permit.",
          "• Object to or revoke previously granted data processing permissions.",
          "To exercise these rights, submit a written request to privacy@newaigent.com or directly to the business administrator.",
        ],
      },
      {
        id: "contacto",
        title: "9. Updates & Contact Information",
        badge: "Contact",
        content: [
          "We periodically update this policy to incorporate legal updates and product enhancements. Significant changes will be prominently highlighted on our website or via admin notifications.",
          `For questions, legal inquiries, or concerns regarding your privacy, please contact our Data Protection Team at privacy@newaigent.com or visit https://newaigent.com.`,
        ],
      },
    ],
  };
}

export function getTermsOfService(lang: Lang, tenantName?: string): LegalDocument {
  const isTenant = !!tenantName && tenantName !== "NewAigent";
  const entityName = isTenant ? tenantName : "NewAigent";

  if (lang === "es") {
    return {
      title: isTenant ? `Términos de Servicio de ${tenantName}` : "Términos de Servicio de NewAigent",
      subtitle: isTenant
        ? `Condiciones generales para compras, servicios y uso de la plataforma digital de ${tenantName}.`
        : "Condiciones contractuales para el uso de la plataforma SaaS multitenant, integraciones y copiloto IA.",
      lastUpdated: "Septiembre 2026",
      effectiveDate: "1 de Septiembre de 2026",
      badge: "Acuerdo Legal",
      summary: isTenant
        ? `Bienvenido a la tienda en línea de ${tenantName}. Al navegar por nuestro catálogo, crear pedidos o agendar citas, aceptas las condiciones de compra, envío y uso descritas a continuación.`
        : "Estos Términos de Servicio rigen el acceso y uso de la plataforma NewAigent, sus herramientas de automatización, CRM, storefronts, copiloto Newy AI y servicios de facturación.",
      sections: [
        {
          id: "aceptacion",
          title: "1. Aceptación de los Términos",
          badge: "Vinculación Legal",
          content: [
            `Al crear una cuenta, realizar compras, o utilizar las herramientas provistas por ${entityName}, aceptas someterte íntegramente a estos Términos de Servicio y a nuestra Política de Privacidad.`,
            "Si no estás de acuerdo con alguna de las cláusulas aquí estipuladas, debes abstenerte de utilizar la plataforma o solicitar la baja de tu cuenta.",
            "Para utilizar nuestros servicios comerciales debes contar con plena capacidad legal para contratar conforme a la legislación aplicable en tu jurisdicción.",
          ],
        },
        {
          id: "cuentas-acceso",
          title: "2. Cuentas de Usuario y Subdominios de Negocio",
          badge: "Cuentas & Seguridad",
          content: [
            "Para acceder a las funciones avanzadas de gestión, el negocio crea un subdominio único e inmutable (ejemplo: clinica.newaigent.com) y credenciales seguras de administrador.",
            "• Responsabilidad de Credenciales: Eres el único responsable de mantener la confidencialidad de tus contraseñas y de todas las actividades realizadas bajo tu cuenta.",
            "• Notificación de Compromiso: Debes notificar de inmediato cualquier uso no autorizado o brecha de seguridad a soporte@newaigent.com.",
            "• Veracidad de Datos: Te comprometes a proporcionar información verídica, vigente y comprobable al registrar tu negocio o tus datos de facturación.",
          ],
        },
        {
          id: "suscripciones-facturacion",
          title: "3. Planes SaaS, Facturación y Cancelación",
          badge: "Suscripciones",
          content: [
            isTenant
              ? `Las compras de productos físicos o servicios en ${tenantName} están sujetas a los precios mostrados en el catálogo al momento de confirmar el pedido.`
              : "NewAigent opera bajo un modelo de suscripción mensual o anual (Starter, Pro y Enterprise) gestionado a través de Stripe Billing:",
            isTenant
              ? "Los pagos son procesados de forma segura mediante tarjeta bancaria (Conekta/Stripe), OXXO Pay o PayPal. Al confirmar tu compra, autorizas el cobro del monto total indicado."
              : "• Renovación Automática: Las suscripciones se renuevan de forma automática al inicio de cada ciclo de facturación salvo que canceles antes de la fecha de corte.",
            !isTenant
              ? "• Cancelación sin Penalizaciones: Puedes cancelar tu plan en cualquier momento desde el panel de administración. Tu acceso continuará activo hasta el fin del período ya pagado."
              : "• Moneda y Precios: Todos los precios se expresan en la divisa visible en el checkout e incluyen los impuestos aplicables salvo especificación contraria.",
          ],
        },
        {
          id: "creditos-ia",
          title: "4. Créditos Newy AI y Modelo de Arbitraje Tecnológico",
          badge: "Medición de IA",
          content: [
            "Los servicios de inteligencia artificial de la plataforma (asistente CRM, generación de posts y automatización de respuestas) se rigen por cuotas de consumo transparente:",
            "• Asignación Mensual: Cada plan incluye un cupo de créditos Newy AI ($15.00 USD en Starter, ampliable a Pro y Enterprise).",
            "• Tarifa de Servicio de Plataforma: El consumo se contabiliza a la tarifa estándar de retail ($3.00 USD por 1M tokens de entrada / $15.00 USD por 1M tokens de salida).",
            "• Auto-Pausa Protectora: Al agotarse la asignación mensual, las campañas sociales se pausan automáticamente para evitar sobrecostos no autorizados.",
            "• Recargas Inmediatas: El administrador puede adquirir saldo adicional con un clic mediante Stripe para reactivar de inmediato sus automatizaciones.",
          ],
          callout: {
            type: "info",
            title: "Disponibilidad Multimodelo de Alta Resiliencia",
            text: "Newy AI utiliza una cascada inteligente de 5 niveles para garantizar 100% de disponibilidad ante fallas o congestiones de proveedores individuales de modelos de lenguaje.",
          },
        },
        {
          id: "comercio-pedidos",
          title: "5. Comercio Electrónico, Envíos y Cumplimiento",
          badge: "E-Commerce",
          content: [
            "En las transacciones de compraventa dentro de los storefronts de los comercios:",
            `• El comercio (${isTenant ? tenantName : "cada negocio titular"}) es el comerciante de registro y responsable directo de la calidad, autenticidad, garantía y entrega física de los productos vendidos.`,
            "• NewAigent provee la infraestructura tecnológica y no asume responsabilidad directa por demoras en paqueterías externas, faltantes de inventario o disputas comerciales entre compradores y comercios.",
            "• En caso de cancelaciones o reembolsos, aplican las políticas comerciales particulares establecidas por cada tienda.",
          ],
        },
        {
          id: "uso-aceptable",
          title: "6. Política de Uso Aceptable",
          badge: "Conducta Permitida",
          content: [
            "Al utilizar nuestros servicios, te comprometes estrictamente a NO:",
            "• Comercializar productos ilegales, medicamentos controlados sin prescripción, armas, o material infractor de propiedad intelectual.",
            "• Enviar spam masivo o comunicaciones no solicitadas violando las políticas de Meta o WhatsApp.",
            "• Intentar ataques de inyección de prompts, jailbreak, o ingeniería inversa contra el copiloto Newy AI o las APIs de la plataforma.",
            "• Vulnerar o intentar eludir los controles de aislamiento multi-tenant para acceder a datos de otros comercios.",
            "El incumplimiento de estas normas faculta a NewAigent para suspender o cancelar la cuenta infractora de forma inmediata y sin derecho a reembolso.",
          ],
        },
        {
          id: "propiedad-intelectual",
          title: "7. Propiedad Intelectual y Licencias",
          badge: "Derechos de Autor",
          content: [
            "• Datos y Marcas del Negocio: El titular del negocio conserva el 100% de la propiedad intelectual de sus marcas, logotipos, fotos de productos y datos de clientes.",
            "• Plataforma y Código: NewAigent conserva todos los derechos, títulos e intereses de la plataforma, software, interfaces, código fuente, algoritmos y la marca Newy AI.",
            "• Se concede al cliente una licencia limitada, no exclusiva, intransferible y revocable para utilizar el software durante la vigencia de su suscripción.",
          ],
        },
        {
          id: "garantias-responsabilidad",
          title: "8. Disponibilidad, Limitación de Responsabilidad",
          badge: "Límites Legales",
          content: [
            "NewAigent realiza sus mejores esfuerzos técnicos para brindar un servicio continuo y seguro con un objetivo de disponibilidad del 99.9% anual.",
            "No obstante, la plataforma se proporciona 'tal cual' y 'según disponibilidad'. En la máxima medida permitida por la ley, NewAigent no será responsable por daños indirectos, pérdida de ingresos, interrupciones de negocio o fallas originadas por caídas de servicios de terceros (Meta, WhatsApp, Google o pasarelas de pago).",
            "La responsabilidad total agregada de NewAigent frente al cliente por cualquier reclamación no excederá el monto efectivamente pagado por dicho cliente en los últimos 3 meses de servicio.",
          ],
        },
        {
          id: "jurisdiccion",
          title: "9. Ley Aplicable y Resolución de Disputas",
          badge: "Jurisdicción",
          content: [
            "Estos Términos de Servicio se regirán e interpretarán de conformidad con las leyes vigentes y aplicables al domicilio de la empresa operadora.",
            "Cualquier controversia derivada de este contrato será sometida en primera instancia a un proceso de mediación de buena fe. De no llegar a un acuerdo en 30 días naturales, las partes se someten expresamente a la jurisdicción de los tribunales competentes.",
          ],
        },
      ],
    };
  }

  // English version
  return {
    title: isTenant ? `${tenantName} Terms of Service` : "NewAigent Terms of Service",
    subtitle: isTenant
      ? `General terms governing purchases, storefront services, and online interactions with ${tenantName}.`
      : "Commercial contract governing access to our multi-tenant SaaS platform, Newy AI copilot, and automation services.",
    lastUpdated: "September 2026",
    effectiveDate: "September 1, 2026",
    badge: "Terms Agreement",
    summary: isTenant
      ? `Welcome to ${tenantName}'s online store. By browsing our catalog, placing orders, or booking appointments, you agree to the conditions, purchase terms, and service policies outlined below.`
      : "These Terms of Service constitute a legally binding agreement governing your access to and use of NewAigent's multi-tenant software, CRM suite, AI Copilot, and automated marketing workflows.",
    sections: [
      {
        id: "aceptacion",
        title: "1. Acceptance of Terms",
        badge: "Binding Agreement",
        content: [
          `By registering an account, purchasing subscriptions or products, or utilizing services provided by ${entityName}, you unconditionally accept and agree to be bound by these Terms of Service and our Privacy Policy.`,
          "If you do not agree with any part of these terms, you must immediately discontinue all use of the platform and request account deactivation.",
          "You represent and warrant that you possess the requisite legal capacity to enter into binding contracts under your local jurisdiction.",
        ],
      },
      {
        id: "cuentas-acceso",
        title: "2. User Accounts & Business Subdomains",
        badge: "Accounts & Security",
        content: [
          "To access business CRM and automation suites, each business creates a dedicated and permanent subdomain (e.g., clinic.newaigent.com) alongside secure administrator credentials.",
          "• Credential Responsibility: You are exclusively responsible for safeguarding access credentials, API keys, and all activities conducted through your business workspace.",
          "• Incident Notification: You must promptly notify us at support@newaigent.com upon detecting unauthorized access or security compromises.",
          "• Accurate Information: You agree to submit accurate, truthful, and updated commercial, contact, and billing details.",
        ],
      },
      {
        id: "suscripciones-facturacion",
        title: "3. SaaS Subscriptions, Billing & Cancellations",
        badge: "Billing Terms",
        content: [
          isTenant
            ? `Purchases of physical goods or appointments at ${tenantName} are billed according to published catalog rates confirmed at checkout.`
            : "NewAigent services are offered on flexible monthly or annual recurring plans (Starter, Pro, Enterprise) billed securely through Stripe:",
          isTenant
            ? "Payments are securely processed via credit/debit card, OXXO Pay, or PayPal. By finalizing checkout, you authorize billing for the total stated amount."
            : "• Automatic Renewal: Subscriptions automatically renew at the beginning of each billing cycle unless cancelled prior to the cutoff date.",
          !isTenant
            ? "• Cancellation Without Penalties: You may cancel your subscription at any time within your admin dashboard; access remains active through your prepaid term."
            : "• Pricing & Currency: All transactions are processed in the currency specified at checkout and include statutory taxes unless expressly stated.",
        ],
      },
      {
        id: "creditos-ia",
        title: "4. Newy AI Credits & Metering Economics",
        badge: "AI Quota & Metering",
        content: [
          "AI operations across the platform (Newy AI CRM inquiries, copy generation, and automated social marketing) operate under transparent credit quotas:",
          "• Monthly Base Allowance: Each subscription tier includes an AI credit allocation ($15.00 USD on Starter, scaled on Pro and Enterprise).",
          "• Retail Metering Rate: Token consumption is metered at standard platform retail rates ($3.00 USD per 1M prompt tokens / $15.00 USD per 1M completion tokens).",
          "• Automated Protective Throttling: When monthly credits deplete, automated social campaigns pause automatically to prevent unexpected overage fees.",
          "• 1-Click Top-Ups: Business administrators can recharge balances instantly via Stripe Checkout from the Credits Drawer to reactivate services.",
        ],
        callout: {
          type: "info",
          title: "Multi-Model Fallback Resilience",
          text: "Newy AI employs an autonomous 5-model cascade to guarantee 100% operational continuity even during upstream third-party model latency or outages.",
        },
      },
      {
        id: "comercio-pedidos",
        title: "5. E-Commerce Storefronts & Fulfillment",
        badge: "Storefront Terms",
        content: [
          "Regarding retail and commerce interactions across tenant storefronts:",
          `• The business merchant (${isTenant ? tenantName : "each independent tenant"}) is the merchant of record responsible for product quality, order fulfillment, shipping, and returns.`,
          "• NewAigent serves as the software technology provider and assumes no direct liability for courier transit delays, inventory discrepancies, or consumer trade disputes.",
          "• Returns, exchanges, and warranty inquiries are subject to the merchant's published store policies.",
        ],
      },
      {
        id: "uso-aceptable",
        title: "6. Acceptable Use & Conduct Policy",
        badge: "Prohibited Actions",
        content: [
          "When utilizing our software and communication channels, you agree never to:",
          "• Sell illicit goods, controlled pharmaceuticals without authorized prescription, weapons, or counterfeit merchandise.",
          "• Transmit unsolicited bulk spam or violate Meta, WhatsApp, or carrier messaging guidelines.",
          "• Perform prompt injection attacks, jailbreaks, or reverse-engineer the Newy AI Copilot or platform endpoints.",
          "• Attempt to breach multi-tenant data boundaries or access another tenant's confidential database records.",
          "Violations of this policy entitle NewAigent to immediately suspend or terminate access without eligibility for refund.",
        ],
      },
      {
        id: "propiedad-intelectual",
        title: "7. Intellectual Property & Brand Ownership",
        badge: "Copyright & IP",
        content: [
          "• Tenant Brand Sovereignty: The tenant retains 100% ownership over their trademarks, logos, product catalogs, photography, and customer CRM records.",
          "• Platform Property: NewAigent retains exclusive worldwide ownership over platform code, UX designs, database architectures, and the Newy AI trademark.",
          "• Subject to ongoing subscription standing, tenants receive a limited, revocable, non-exclusive license to operate the software for business purposes.",
        ],
      },
      {
        id: "garantias-responsabilidad",
        title: "8. Service Uptime & Limitation of Liability",
        badge: "Warranty Disclaimer",
        content: [
          "We strive to maintain an annual service availability target of 99.9% across platform storefronts and CRM endpoints.",
          "However, services are provided 'as is' and 'as available'. To the fullest extent permissible by law, NewAigent disclaims all implied warranties and shall not be liable for indirect, incidental, or consequential damages resulting from third-party vendor downtime (Meta, WhatsApp, Google, or payment gateways).",
          "Our cumulative financial liability for any claim shall not exceed the aggregate subscription amounts paid by you during the three (3) months preceding the event.",
        ],
      },
      {
        id: "jurisdiccion",
        title: "9. Governing Law & Dispute Resolution",
        badge: "Legal Jurisdiction",
        content: [
          "These Terms of Service are governed by and construed in accordance with applicable laws without regard to conflict-of-law doctrines.",
          "Any dispute arising from these terms shall first be addressed through good-faith mediation. If unresolved within thirty (30) days, disputes shall be submitted to the competent courts having jurisdiction over the company's operating headquarters.",
        ],
      },
    ],
  };
}
