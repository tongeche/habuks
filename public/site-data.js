window.siteData = () => ({
  orgName: "Habuks",
  groupName: "Habuks Platform",
  orgTagline: "Collective Operations SaaS",
  theme: {
    sidebar: "#0b1226",
    sidebarAlt: "#14203a",
    sidebarAlt2: "#1b2b4f",
    primary: "#1f7a8c",
    primaryDark: "#0f5f63",
    secondary: "#2dd4bf",
    accent: "#f97316",
    accentDark: "#ea580c",
    ink: "#0f172a",
    offWhite: "#f8fafc"
  },
  heroHeadline: "Run every collective on one platform",
  heroIntro: [
    "Habuks is a multi-tenant operations platform for community organizations, cooperatives, and micro-enterprises.",
    "Create secure workspaces for each group, track projects and IGAs, and keep contributions, welfare, and records in one place.",
    "Launch quickly with role-based access and clear audit trails."
  ],
  heroImages: [
    {
      src: "/assets/hero-saas-1.svg",
      alt: "Habuks workspace overview."
    },
    {
      src: "/assets/hero-saas-2.svg",
      alt: "Multi-tenant operations dashboard."
    },
    {
      src: "/assets/hero-saas-3.svg",
      alt: "Activity timelines and reports."
    }
  ],
  heroIntervalMs: 2000,
  impactStrip: {
    id: "impact",
    kicker: "IMPACT",
    title: "Community impact at a glance",
    description:
      "Quick metrics that show how collectives are growing their programs and member support.",
    items: [
      { value: "28", label: "Active workspaces" },
      { value: "340+", label: "Members supported" },
      { value: "6", label: "Income programs" },
      { value: "KSh 1.2M", label: "Tracked contributions" }
    ]
  },
  programsSection: {
    id: "programs",
    kicker: "PROGRAMS",
    title: "Programs inside every tenant workspace",
    description:
      "Each tenant can launch multiple projects with unique goals, budgets, and impact targets.",
    items: [
      {
        title: "Poultry Incubation Initiative",
        description:
          "A flagship income-generating activity focused on incubation, brooding, and poultry sales.",
        tag: "Income-Generating Activity",
        status: "Active",
        highlights: [
          "Incubation and brooder management",
          "Egg production tracking",
          "Market-ready poultry sales"
        ],
        cta: { label: "See poultry plan", href: "#contact" }
      },
      {
        title: "Jongol Groundnut Foods",
        description:
          "A community agribusiness initiative covering cultivation, processing, and branded sales.",
        tag: "Value Addition",
        status: "Scaling",
        highlights: [
          "Groundnut aggregation",
          "Peanut butter processing",
          "Local market distribution"
        ],
        cta: { label: "Explore the roadmap", href: "#contact" }
      }
    ]
  },
  objectivesSection: {
    id: "about",
    kicker: "OBJECTIVES & GOALS",
    title: "What we are building toward",
    description:
      "Tenant workspaces align their projects with clear objectives and measurable community goals.",
    objectivesTitle: "Objectives",
    goalsTitle: "Goals",
    objectives: [
      "Create reliable income streams for members",
      "Document project performance consistently",
      "Improve transparency for partners and donors"
    ],
    goals: [
      "Grow member savings and welfare funds",
      "Expand local market access",
      "Build sustainable community enterprises"
    ],
    image: {
      src: "/assets/about-saas.svg",
      alt: "Community objectives and goals."
    }
  },
  testimonialsSection: {
    id: "testimonials",
    kicker: "STORIES",
    title: "What members are saying",
    description: "Highlights from members and leaders using Habuks workspaces.",
    items: [
      {
        quote: "Habuks keeps our poultry program organized and transparent for every member.",
        name: "Mary Akinyi",
        role: "Project Lead"
      },
      {
        quote: "We can finally track welfare cycles without spreadsheets or confusion.",
        name: "John Ochieng",
        role: "Treasurer"
      },
      {
        quote: "The dashboard gives us confidence when reporting to partners.",
        name: "Grace Atieno",
        role: "Committee Member"
      }
    ]
  },
  highlight: {
    id: "highlights",
    kicker: "BUILT FOR MULTI-TENANT",
    title: "Separate workspaces, shared oversight",
    description:
      "Give every group its own workspace while keeping global visibility for admins, partners, and support teams.",
    image: {
      src: "/assets/highlight-saas.svg",
      alt: "Shared oversight across tenant workspaces."
    },
    badge: {
      number: "01",
      label: "Multi-tenant Core"
    },
    cta: {
      label: "See how it works",
      href: "#what-we-do"
    },
    items: [
      "Isolated data per workspace",
      "Role-based access by tenant",
      "Audit-ready activity logs",
      "Templates for fast setup"
    ]
  },
  whatWeDoSection: {
    id: "what-we-do",
    kicker: "FEATURES",
    title: "Everything teams need to run operations",
    description:
      "From member records to project and IGA tracking, Habuks keeps daily work organized across tenants.",
    items: [
      {
        title: "Workspace and member management",
        description:
          "Create tenants, invite members, assign roles, and manage access with clear permissions.",
        image: {
          src: "/assets/feature-workspaces.svg",
          alt: "Workspace and member management."
        },
        cta: {
          label: "Explore features",
          href: "#highlights"
        }
      },
      {
        title: "Projects, IGAs, and finance tracking",
        description:
          "Log activities, expenses, sales, contributions, and welfare cycles with structured, searchable records.",
        image: {
          src: "/assets/feature-ops.svg",
          alt: "Project and finance tracking."
        },
        cta: {
          label: "View modules",
          href: "#volunteer"
        }
      }
    ]
  },
  volunteerSection: {
    id: "volunteer",
    kicker: "WHO IT IS FOR",
    title: "Built for collectives that share responsibility",
    description:
      "Habuks helps groups manage operations without spreadsheets or scattered WhatsApp threads.",
    image: {
      src: "/assets/tenants-saas.svg",
      alt: "Teams coordinating across tenant workspaces."
    },
    items: [
      {
        icon: "users",
        title: "Self-help groups and cooperatives",
        description:
          "Run contributions, welfare, and projects in one place with shared visibility."
      },
      {
        icon: "folder",
        title: "NGOs and community programs",
        description:
          "Support multiple partner groups with clear oversight and consistent reporting."
      }
    ],
    cta: {
      label: "Talk to us",
      href: "#contact"
    },
    stats: [
      { value: "Multi-tenant", label: "Separate workspaces" },
      { value: "Role-based", label: "Access control" },
      { value: "Audit-ready", label: "Activity records" },
      { value: "Mobile-first", label: "On any device" }
    ]
  },
  aboutSection: {
    id: "about",
    kicker: "WHY HABUKS",
    title: "Operational clarity for every tenant",
    description:
      "Designed for low-resource environments and teams that need accountability without complexity.",
    image: {
      src: "/assets/about-saas.svg",
      alt: "Habuks product overview."
    },
    cards: [
      { title: "Multi-tenant workspaces", icon: "mission" },
      { title: "Role-based permissions", icon: "vision" },
      { title: "Structured data model", icon: "values" },
      { title: "Scales with you", icon: "history" }
    ],
    stats: {
      value: "Built with operators",
      label: "Community-first product",
      avatars: [
        { src: "/assets/avatar-1.webp", alt: "Community member" },
        { src: "/assets/avatar-2.webp", alt: "Community member" },
        { src: "/assets/avatar-3.webp", alt: "Community member" }
      ]
    }
  },
  updatesSection: {
    id: "updates",
    kicker: "LATEST FROM HABUKS",
    title: "Product updates and rollout notes",
    description: "What we are building for multi-tenant operations.",
    items: [
      {
        title: "Tenant setup in minutes",
        description:
          "Spin up new workspaces with templates, roles, and default modules.",
        image: {
          src: "/assets/update-templates.svg",
          alt: "Workspace setup screens."
        },
        link: {
          label: "Learn more",
          href: "#contact"
        }
      },
      {
        title: "IGA tracking that stays consistent",
        description:
          "Standardize project, expense, and sales logs across all tenants.",
        image: {
          src: "/assets/update-iga.svg",
          alt: "Consistent project tracking."
        },
        link: {
          label: "Learn more",
          href: "#contact"
        }
      },
      {
        title: "Audit-friendly reporting",
        description:
          "Exportable records and clear histories for partners and committees.",
        image: {
          src: "/assets/update-audit.svg",
          alt: "Reports and audit trails."
        },
        link: {
          label: "Learn more",
          href: "#contact"
        }
      }
    ]
  },
  ctaBanner: {
    id: "get-involved",
    kicker: "GET STARTED",
    title: "Get involved with the collective",
    description:
      "Support the mission, join a program, or partner with us on the next initiative.",
    backgroundImage: "",
    cta: {
      label: "Donate / Join / Partner",
      href: "#contact"
    }
  },
  nav: [
    { label: "Platform", href: "#what-we-do" },
    { label: "Multi-tenant", href: "#highlights" },
    { label: "Who It's For", href: "#volunteer" },
    { label: "Security", href: "#about" },
    { label: "Contact", href: "#contact" }
  ],
  tenantNav: [
    { label: "Home", href: "#top" },
    { label: "About", href: "#about" },
    { label: "Programs", href: "#programs" },
    { label: "Impacts", href: "#impact" },
    { label: "Get involved", href: "#get-involved" },
    { label: "Contact us", href: "#contact" }
  ],
  tenantCta: { label: "Donate / Join / Partner", href: "#get-involved" },
  cta: [
    { label: "Request a demo", href: "#contact", style: "primary" },
    { label: "View features", href: "#what-we-do", style: "ghost" }
  ],
  header: {
    topEmails: ["hello@habuks.com"],
    donate: { label: "Request Demo", href: "#contact" },
    menuLabel: "Menu",
    nav: [
      { label: "Home", href: "#top" },
      { label: "Platform", href: "#what-we-do" },
      { label: "Multi-tenant", href: "#highlights" },
      { label: "Who It's For", href: "#volunteer" },
      { label: "Security", href: "#about" },
      { label: "Contact", href: "#contact" }
    ]
  },
  socialLinks: [
    { label: "Facebook", href: "https://facebook.com", icon: "facebook" },
    { label: "X", href: "https://x.com", icon: "x" },
    { label: "Instagram", href: "https://instagram.com", icon: "instagram" },
    { label: "LinkedIn", href: "https://linkedin.com", icon: "linkedin" },
    { label: "YouTube", href: "https://youtube.com", icon: "youtube" }
  ],
  whatWeDoTitle: "Core modules",
  whatWeDoIntro: "",
  whatWeDo: [
    "Member management",
    "Projects and IGAs",
    "Contributions and welfare",
    "Reports and documents"
  ],
  about: {
    title: "About Us",
    whoTitle: "Who We Are",
    who: "JONGOL SELF HELP GROUP is a member-led organisation established to promote economic empowerment, self-reliance, and social well-being.",
    governance: "The Group operates under a formal constitution and is governed through democratic decision-making, regular meetings, and transparent financial management.",
    missionTitle: "Our Mission",
    mission: "To improve livelihoods and food security through community-owned income-generating initiatives and responsible resource management.",
    visionTitle: "Our Vision",
    vision: "A self-reliant and empowered community with sustainable sources of income and improved quality of life.",
    valuesTitle: "Our Values",
    values: [
      "Unity and mutual support",
      "Accountability and transparency",
      "Hard work and self-reliance",
      "Sustainability and community ownership"
    ]
  },
  projectsTitle: "Our Projects",
  projectsIntro: "JONGOL SELF HELP GROUP implements structured Income-Generating Activities (IGAs) as internal projects. Each project has its own identity and management structure while remaining fully accountable to the Group.",
  projects: [
    {
      code: "JPP",
      name: "Poultry Incubation Initiative",
      type: "Income-Generating Activity (IGA)",
      status: "Active | Scaling Phase",
      overview: "JPP - Poultry Incubation Initiative is a flagship enterprise project focused on sustainable poultry production through incubation, layers, and broilers farming.",
      detail: "The project is designed to reduce production costs, improve breed quality, and scale poultry output for both household income and local market supply.",
      focusTitle: "Project Focus Areas",
      focus: [
        "Poultry incubation (primary funding focus - Phase 1)",
        "Rearing of layers and broilers",
        "Egg production and poultry meat sales",
        "Skills development in poultry management and biosecurity"
      ],
      objectivesTitle: "Objectives",
      objectives: [
        "Establish reliable poultry incubation capacity",
        "Increase poultry stock sustainably",
        "Generate steady income for group members",
        "Improve access to affordable protein in the community"
      ],
      impactTitle: "Impact",
      impact: [
        "Direct income generation for members",
        "Improved food security and nutrition",
        "Scalable model for future agricultural enterprise"
      ]
    },
    {
      code: "JGF",
      name: "Jongol Groundnut Foods",
      type: "Income-Generating Activity (IGA)",
      status: "Development Phase",
      overview: "JGF - Jongol Groundnut Foods is a value-addition agribusiness initiative focused on groundnut farming, processing, and peanut butter production.",
      detail: "The project aims to move beyond raw produce sales by introducing processing, packaging, and local market distribution, increasing incomes and promoting nutrition.",
      focusTitle: "Project Focus Areas",
      focus: [
        "Groundnut cultivation and aggregation",
        "Peanut butter processing and hygiene standards",
        "Value addition and branding",
        "Local market sales and distribution"
      ],
      objectivesTitle: "Objectives",
      objectives: [
        "Increase value of groundnuts through processing",
        "Create a sustainable community food enterprise",
        "Improve household incomes and nutrition",
        "Build skills in agro-processing and small-scale manufacturing"
      ]
    }
  ],
  governance: {
    title: "Governance & Accountability",
    managementTitle: "How We Are Managed",
    management: "JONGOL SELF HELP GROUP is governed by elected officials accountable to members through General Meetings.",
    committees: "Each project (JPP and JGF) operates under a project committee that manages day-to-day activities and reports to the Group's leadership.",
    financialTitle: "Financial Accountability",
    financial: [
      "All funds are managed through the Group's official bank account",
      "Project finances are tracked separately for transparency",
      "Regular financial and activity reports are shared with members and partners"
    ]
  },
  partnerships: {
    title: "Partnerships & Funding",
    intro: "JONGOL SELF HELP GROUP welcomes partnerships with:",
    partnersTitle: "Working With Us",
    partners: [
      "County Government Departments",
      "Development partners and NGOs",
      "Donors and well-wishers"
    ],
    supportTitle: "Support May Include",
    supportIntro: "Support may include:",
    support: [
      "Project funding",
      "Technical assistance and training",
      "Equipment and infrastructure support"
    ],
    closing: "All partnerships are guided by accountability, community ownership, and shared development goals."
  },
  documents: {
    title: "Documents & Transparency",
    intro: "Available upon request:",
    list: [
      "Registration certificate",
      "Constitution",
      "Project proposals (JPP & JGF)",
      "Meeting resolutions and reports"
    ]
  },
  contact: {
    title: "Contact Habuks",
    intro: "Tell us about your organization and the workspaces you want to support.",
    kicker: "CONTACT US",
    panelTitle: "Ready to get started?",
    panelDescription: "Share your goals and we will help you set up the right workspace.",
    location: "Remote-first",
    phone: "",
    email: "hello@habuks.com",
    actions: [
      { label: "Email us", href: "mailto:hello@habuks.com", style: "primary" },
      { label: "Member Login", href: "/login", style: "ghost" }
    ]
  },
  footer: {
    blurb: "Multi-tenant operations for community organizations.",
    quickLinksTitle: "Quick Links",
    quickLinks: [
      { label: "About", href: "#about" },
      { label: "Programs", href: "#programs" },
      { label: "Impacts", href: "#impact" },
      { label: "Get involved", href: "#get-involved" },
      { label: "Contact us", href: "#contact" }
    ],
    contactTitle: "Contact",
    socialTitle: "Follow Us",
    legal: "Habuks. All rights reserved."
  },
  footerNote: "Multi-tenant operations for community organizations.",
  year: new Date().getFullYear(),
  get phoneIsPlaceholder() {
    return !this.contact.phone || this.contact.phone.includes("Add");
  },
  get phoneHref() {
    if (this.phoneIsPlaceholder) {
      return "";
    }
    return "tel:" + this.contact.phone.replace(/[^+\d]/g, "");
  }
});
