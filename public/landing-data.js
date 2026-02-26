window.landingData = () => ({
  orgName: "Habuks",
  orgTagline: "",
  heroVariant: "split",
  heroHeadline: "Bring Structure to Your Community Group",

  heroIntro: [
    "Manage contributions, income activities, and records with clarity and accountability ",

  ],
  heroImage: "/assets/hero-1.png",
  heroIntervalMs: 2200,
  heroCards: [
    {
      title: "Contribution received",
      subtitle: "Member savings",
      amount: "KSh 4,500"
    },
    {
      title: "Expense logged",
      subtitle: "Poultry feed",
      amount: "KSh 12,500"
    }
    ,
    {
      title: "Project created",
      subtitle: "New IGA",
      amount: "1"
    },
    {
      title: "Member joined",
      subtitle: "New member",
      amount: "+1"
    }
  ],
  heroTrust: [],
  aboutSection: {
    id: "why-habuks",
    kicker: "WHY HABUKS",
    title: "Built for clarity, accountability, and scale",
    description:
      "Habuks is designed for low-resource environments where teams need reliable operations without complexity.",
    image: {
      src: "/assets/tenant-website-about.png",
      alt: "Habuks product overview."
    },
    cards: [
      { title: "Structured data model", icon: "values" },
      { title: "Role-based access", icon: "vision" },
      { title: "Audit-ready logs", icon: "mission" },
      { title: "Scales across tenants", icon: "history" }
    ],
    stats: {
      value: "Ops-ready",
      label: "Designed for real teams",
      avatars: [
        { src: "/assets/avatar-1.webp", alt: "Community member" },
        { src: "/assets/avatar-2.webp", alt: "Community member" },
        { src: "/assets/avatar-3.webp", alt: "Community member" }
      ]
    }
  },
  updatesSection: {
    id: "updates",
    kicker: "LATEST UPDATES",
    title: "Product improvements in motion",
    description: "Shipping the building blocks for multi-tenant ops.",
    items: [
      {
        title: "Tenant setup in minutes",
        description:
          "Spin up new workspaces with templates, roles, and default modules.",
        image: {
          src: "/assets/tenants-user.png",
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
    id: "newsletter",
    variant: "newsletter",
    kicker: "STAY UP TO DATE",
    title: "Stay up to date",
    description:
      "Join our email list to get the latest insights, product updates, and community stories.",
    form: {
      inputPlaceholder: "Enter email",
      buttonLabel: "Sign up",
      note: {
        prefix: "No spam.",
        linkLabel: "Unsubscribe",
        linkHref: "#"
      }
    }
  },
  nav: [
    { label: "Features", href: "#modules" },
    { label: "Resources", href: "/resources" },
    { label: "Pricing", href: "#pricing" }
  ],
  cta: [
    { label: "Request a demo", href: "/request-demo", style: "outline" },
    { label: "Start free trial", href: "/get-started", style: "primary" }
  ],
  heroSecondaryLink: null,
  header: {
    topEmails: [],
    donate: { label: "Request demo", href: "/request-demo" },
    menuLabel: "Menu",
    nav: [
      { label: "Features", href: "#modules" },
      { label: "Resources", href: "/resources" },
      { label: "Pricing", href: "#pricing" }
    ],
    actions: {
      login: { label: "Log in", href: "/login" },
        primary: { label: "Start Free", href: "/get-started" }
    }
  },
  socialLinks: [
    { label: "Facebook", href: "https://facebook.com", icon: "facebook" },
    { label: "X", href: "https://x.com", icon: "x" },
    { label: "Instagram", href: "https://instagram.com", icon: "instagram" },
    { label: "LinkedIn", href: "https://linkedin.com", icon: "linkedin" },
    { label: "YouTube", href: "https://youtube.com", icon: "youtube" }
  ],
  contact: {
    title: "Contact Habuks",
    intro: "Tell us about your organization and the workspaces you want to support.",
    location: "Remote-first",
    phone: "",
    email: "hello@habuks.com"
  },
  footer: {
    blurb: "Collective operations & IGA management platform.",
    columns: [
      {
        title: "Learn more",
        links: [
          { label: "All features", href: "#modules" },
          { label: "How it works", href: "#how-it-works" },
          { label: "Hosted website", href: "#hosted-site" },
          { label: "Pricing", href: "#pricing" },
          { label: "Success stories", href: "#resources" }
        ]
      },
      {
        title: "Tools & API",
        links: [
          { label: "API documentation", href: "#" },
          { label: "Integrations, tools & apps", href: "#" },
          { label: "Templates", href: "#resources" },
          { label: "Reports & exports", href: "#security" },
          { label: "Hosted themes", href: "#hosted-site" }
        ]
      },
      {
        title: "Support",
        links: [
          { label: "Help center", href: "/support" },
          { label: "FAQs", href: "#faq" },
          { label: "Contact us", href: "#contact" },
          { label: "Platform status", href: "#" },
          { label: "Resources", href: "/resources" }
        ]
      },
      {
        title: "Company",
        links: [
          { label: "Blog", href: "/blog" },
          { label: "About us", href: "/about" },
          { label: "Careers", href: "#" },
          { label: "Press & partnerships", href: "#" },
          { label: "Affiliate program", href: "#" }
        ]
      }
    ],
    legalLinks: [
      { label: "Terms of Service", href: "/gtc" },
      { label: "Privacy policy", href: "/privacy-policy" },
      { label: "Cookie policy", href: "/cookie-policy" },
      { label: "Security", href: "#security" }
    ],
    legal: "Habuks. All rights reserved."
  },
  footerNote: "Collective operations & IGA management platform.",
  year: new Date().getFullYear(),
  benefitsSection: {
    id: "modules",
    kicker: "Management Platform",
    title: "Do more, in less time.",
    description:
      "Access tools that reduce administrative work while keeping members, projects, and finances organized.",
    layout: "image",
    centerImage: {
      src: "/assets/metric2.png",
      alt: "Habuks product overview screenshot."
    },
    imageTags: [
      { label: "Member coordination", position: "left-top", icon: "users" },
      { label: "Projects", position: "left-mid", icon: "briefcase" },
      { label: "Welfare cycles", position: "left-bottom", icon: "heart" },
      { label: "Finance clarity", position: "right-top", icon: "wallet" },
      { label: "Partner reports", position: "right-mid", icon: "newspaper" },
      { label: "Role-based access", position: "right-bottom", icon: "folder" }
    ]
  },
  profilesSection: {
    id: "profiles",
    kicker: "User Profiles",
    title: "Collaborate as a team",
    description:
      "Assign roles and permissions so every member sees exactly what they need, while sensitive records stay protected.",
    layout: "carousel",
    items: [
      {
        title: "Create users and assign teams",
        description:
          "Set up accounts for members and place them into the right groups for smoother coordination.",
        image: {
          src: "/assets/tenants-user.png",
          alt: "User and team management interface."
        }
      },
      {
        title: "Control what each member can see",
        description:
          "Apply role-based permissions so records are visible only to the people who need them.",
        image: {
          src: "/assets/highlight-saas.png",
          alt: "Permissions and user profile views."
        }
      }
    ]
  },
  advantageSection: {
    id: "advantage",
  
    title: "Discover what Habuks brings to your team",
    description:
      "Tools that keep members aligned, projects visible, and reports ready for partners.",
    image: {
      src: "/assets/members-scale.png",
      alt: "Habuks advantage overview"
    },
    items: [
      {
        title: "Member coordination",
        description: "Keep attendance, contributions, and communications in one place.",
        icon: "users"
      },
      {
        title: "Project visibility",
        description: "Track IGAs, expenses, and outcomes without losing context.",
        icon: "briefcase"
      },
      {
        title: "Welfare readiness",
        description: "Run welfare cycles with approvals and transparent records.",
        icon: "heart"
      },
      {
        title: "Partner reporting",
        description: "Share audit-ready summaries with donors and committees.",
        icon: "newspaper"
      }
    ]
  },
  stepsId: "how-it-works",
  stepsKicker: "HOW IT WORKS",
  stepsTitle: "See your project workspace in action",
  stepsDescription: "From overview and expenses to documents, tasks, and notes, everything stays connected in one workflow.",
  steps: [
    {
      title: "Invite organization members",
      description: "Bring more eyes to the work by inviting reviewers and collaborators in minutes.",
      tag: "Bring more eyes to the work",
      layout: "media-right",
      icon: "users",
      highlights: [
        "No extra setup for reviewers.",
        "Great for product, design, and QA.",
        "Catch issues before launch."
      ],
      image: {
        src: "/assets/invite-members.png",
        alt: "Invite organization members screen with connected team avatars."
      }
    },
    {
      title: "Track project performance from one overview",
      description: "Monitor progress, budget usage, and expense quality from a single project dashboard.",
      tag: "Overview tab",
      icon: "chart",
      highlights: [
        "See progress, budget used, and documentation KPIs instantly.",
        "Switch between 30D, 90D, and 12M ranges for trend analysis.",
        "Spot top expense categories without leaving the project page."
      ],
      image: {
        src: "/assets/data-metric.png",
        alt: "Project overview dashboard with KPI cards and trend insights."
      }
    },
    {
      title: "Capture expenses with receipts and categories",
      description: "Record spend details, attach proof, and keep expense records ready for reviews.",
      tag: "Expenses tab",
      icon: "wallet",
      highlights: [
        "Log amount, vendor, date, and payment references consistently.",
        "Upload receipts so every expense has supporting proof.",
        "Organize categories for cleaner reconciliation and reporting."
      ],
      image: {
        src: "/assets/metrics.png",
        alt: "Expense and financial insights for an active project."
      }
    },
    {
      title: "Keep all project documents in one place",
      description: "Store proposals, work plans, and reports in a central project document workspace.",
      tag: "Documents tab",
      icon: "file",
      highlights: [
        "Upload PDF and DOCX files directly to the project.",
        "Generate templates like concept notes and activity reports.",
        "Rename, archive, and retrieve files with less friction."
      ],
      image: {
        src: "/assets/update-audit.png",
        alt: "Project documentation and reporting workflow view."
      }
    },
    {
      title: "Coordinate tasks with clear ownership",
      description: "Assign tasks, set priorities, and track due dates so execution stays on course.",
      tag: "Tasks tab",
      icon: "check",
      highlights: [
        "Filter by status and assignee to focus team effort.",
        "Track overdue and high-priority items early.",
        "Move work from open to done with a shared view of progress."
      ],
      image: {
        src: "/assets/automated-tracking.png",
        alt: "Task tracking board and workflow automation view."
      }
    },
    {
      title: "Capture decisions and updates as project notes",
      description: "Document follow-ups and important context with visibility controls for each note.",
      tag: "Notes tab",
      icon: "edit",
      highlights: [
        "Write structured notes linked to active project work.",
        "Choose project-team or admin-only visibility when needed.",
        "Search notes quickly when preparing updates and reports."
      ],
      image: {
        src: "/assets/highlight-saas.png",
        alt: "Project notes and collaboration context panel."
      }
    },
    {
      title: "Create and launch a project with guided steps",
      description: "Use the built-in form flow to capture project details before execution begins.",
      tag: "Live demo",
      demo: "new-project",
      icon: "folder",
      highlights: [
        "Define project identity, dates, and operational summary.",
        "Prepare structure for budgeting, members, and media.",
        "Start clean with a repeatable creation workflow."
      ]
    }
  ],
  security: {
    id: "security",
    kicker: "",
    title: "Built-in confidence",
    description:
      "Operational clarity with smart tracking, real-time visibility, and audit-ready records.",
    cards: [
      {
        title: "Automated task tracking",
        description:
          "Cut manual follow-ups so coordinators focus on projects and member support.",
        image: {
          src: "/assets/automated-tracking.png",
          alt: "Task tracking overview."
        }
      },
      {
        title: "Program insights",
        description:
          "Spot trends across projects and welfare cycles with real-time analytics.",
        image: {
          src: "/assets/metrics.png",
          alt: "Program insights dashboard."
        }
      },
      {
        title: "Secure, auditable records",
        description:
          "Role-based access, approvals, and export-ready logs keep every record accountable.",
        image: {
          src: "/assets/update-audit.png",
          alt: "Audit-ready reports view."
        }
      },
      {
        title: "Finance clarity",
        description:
          "Track savings, expenses, and payouts with a single source of truth.",
        image: {
          src: "/assets/highlight-saas.png",
          alt: "Finance clarity overview."
        }
      }
    ]
  }
  ,
  hostedSiteSection: {
    id: "hosted-site",
    kicker: "HOSTED WEBSITE",
    title: "Free, hosted organization website",
    description:
      "Give your group a public presence with a branded site that’s fast to launch and easy to keep updated.",
    features: [
      {
        title: "Instant public page",
        description: "Share your mission, projects, and updates without hiring a developer.",
        icon: "home"
      },
      {
        title: "Custom branding",
        description: "Use your logo, colors, and messaging to stay consistent everywhere.",
        icon: "values"
      },
      {
        title: "Hosted by Habuks",
        description: "We handle security, uptime, and updates while you focus on the work.",
        icon: "check-circle"
      }
    ],
    cta: {
      label: "Request a demo",
      href: "/request-demo"
    },
    image: {
      src: "/assets/free-website-screenshot.png",
      alt: "Hosted website preview."
    },
    themeCarousel: {
      showHeader: false,
      kicker: "THEME CAROUSEL",
      title: "Preview tenant website sections",
      description:
        "Swipe through hero, about, projects, updates, and donation layouts for your hosted site.",
      slides: [
        {
          title: "Hero layout",
          description: "Lead with your mission and a clear call to action.",
          image: {
            src: "/assets/tenant-website-hero.png",
            alt: "Tenant website hero section."
          }
        },
        {
          title: "About section",
          description: "Explain your purpose, values, and community focus.",
          image: {
            src: "/assets/tenant-website-about.png",
            alt: "Tenant website about section."
          }
        },
        {
          title: "Projects section",
          description: "Highlight ongoing initiatives and impact stories.",
          image: {
            src: "/assets/tenant-website-projects.png",
            alt: "Tenant website projects section."
          }
        },
        {
          title: "Updates section",
          description: "Share announcements and milestones with your community.",
          image: {
            src: "/assets/tenant-website-updates.png",
            alt: "Tenant website updates section."
          }
        },
        {
          title: "Donation section",
          description: "Make it easy for supporters to contribute.",
          image: {
            src: "/assets/tenant-website-donate.png",
            alt: "Tenant website donation section."
          }
        }
      ]
    }
  },
  resourcesSection: {
    id: "",
    kicker: "RESOURCES",
    title: "Guides and stories for organized teams",
    description:
      ".",
    featured: {
      title: "How community groups keep reporting on track",
      description:
        "A simple cadence for contributions, welfare, and project updates that keeps every member aligned.",
      image: {
        src: "/assets/iga-no-spreadsheets.png",
        alt: "Team reviewing community reports."
      },
      author: {
        name: "Dylan Muringu",
        avatar: "/assets/avatar-1.webp",
        date: "Jul 27, 2025",
        readTime: "8 min read"
      }
    },
    items: [
      {
        title: "Member engagement that scales",
        description:
          "Use roles, reminders, and shared dashboards to keep participation strong.",
        image: {
          src: "/assets/updates-3.webp",
          alt: "Workspace with notebook and coffee."
        },
        author: {
          name: "Cecilia Evans",
          avatar: "/assets/avatar-3.webp",
          date: "May 2, 2025",
          readTime: "4 min read"
        }
      }
    ]
  },
  faqSection: {
    id: "faq",
    kicker: "HELP CENTER",
    title: "Get answers fast",
    description:
      "Start with quick guides, review popular questions, or reach out if you need more help.",
    supportPage: {
      title: "Habuks Help Center",
      description:
        "Browse popular questions or search for answers about setup, permissions, and reporting.",
      sidebarTitle: "Popular questions",
      cta: {
        title: "Can’t find the answer?",
        description: "Send us your question and we’ll help you quickly.",
        button: {
          label: "Contact support",
          href: "mailto:support@habuks.com"
        }
      }
    },
    resources: [
      {
        title: "Getting started",
        description: "Create a workspace, invite members, and set roles in minutes.",
        image: {
          src: "/assets/members-scale.png",
          alt: "Workspace setup illustration."
        }
      },
      {
        title: "Contributions tracking",
        description: "Capture savings, payouts, and statements with clean reporting.",
        image: {
          src: "/assets/feature-ops.svg",
          alt: "Operations tracking illustration."
        }
      },
      {
        title: "Hosted website",
        description: "Publish a branded site with projects, updates, and donations.",
        image: {
          src: "/assets/tenants-saas.svg",
          alt: "Hosted website illustration."
        }
      },
      {
        title: "Reports & audits",
        description: "Export audit-ready summaries for committees and partners.",
        image: {
          src: "/assets/highlight-saas.svg",
          alt: "Reporting highlights illustration."
        }
      }
    ],
    categories: [
      { slug: "getting-started", label: "Getting Started" },
      { slug: "contributions-tracking", label: "Contributions & Money Tracking" },
      { slug: "transparency-trust", label: "Transparency & Trust" },
      { slug: "technical-access", label: "Technical & Access" },
      { slug: "pricing-plans", label: "Pricing & Plans" },
      { slug: "growth-scale", label: "Growth & Scale" },
      { slug: "reports-audits", label: "Reports & Audits" },
      { slug: "hosted-website", label: "Hosted Website" }
    ],
    popularLabel: "POPULAR",
    popularLimit: 6,
    popular: [
      {
        question: "What is Habuks?",
        answer:
          "Habuks is a financial management platform built for community groups. It helps you track contributions, projects, income activities, and payouts in one clear dashboard.",
        category: "getting-started"
      },
      {
        question: "Who is Habuks for?",
        answer:
          "Habuks is designed for self-help groups, chamas, youth groups, women’s groups, cooperatives, and small community organizations managing shared money.",
        category: "getting-started"
      },
      {
        question: "Do we need accounting knowledge to use it?",
        answer:
          "No. Habuks is built for non-accountants. If you can use WhatsApp or basic spreadsheets, you can use Habuks.",
        category: "getting-started"
      },
      {
        question: "How long does it take to set up?",
        answer:
          "You can create your group and start tracking contributions in minutes.",
        category: "getting-started"
      },
      {
        question: "Can we track member contributions?",
        answer:
          "Yes. You can record contributions, see who has paid, and track balances in real time.",
        category: "contributions-tracking"
      },
      {
        question: "Can members see their own records?",
        answer:
          "Yes. Members can view transparent records depending on their access level.",
        category: "contributions-tracking"
      },
      {
        question: "Can we track income-generating activities (IGA)?",
        answer:
          "Yes. You can log sales, expenses, and profits for your group projects.",
        category: "contributions-tracking"
      },
      {
        question: "Can we record expenses and payouts?",
        answer:
          "Yes. Every payout and expense can be logged and categorized for full transparency.",
        category: "contributions-tracking"
      },
      {
        question: "How does Habuks improve transparency?",
        answer:
          "All financial activity is recorded in one shared system. This reduces disputes, forgotten payments, and unclear records.",
        category: "transparency-trust"
      },
      {
        question: "Can we restrict access to sensitive information?",
        answer:
          "Yes. Admins can assign roles and control what members can see or edit.",
        category: "transparency-trust"
      },
      {
        question: "Is our data secure?",
        answer:
          "Yes. Habuks stores data securely and protects access through authenticated accounts.",
        category: "transparency-trust"
      },
      {
        question: "Does Habuks work on mobile?",
        answer:
          "Yes. It works on phones, tablets, and computers through a web browser.",
        category: "technical-access"
      },
      {
        question: "Do we need to install anything?",
        answer:
          "No. Habuks runs online. There is nothing to install.",
        category: "technical-access"
      },
      {
        question: "Can we export our data?",
        answer:
          "Yes. You can export records for reporting or backup purposes.",
        category: "technical-access"
      },
      {
        question: "Is there a free plan?",
        answer:
          "Yes. You can start with a free trial to test the platform.",
        category: "pricing-plans"
      },
      {
        question: "How is pricing structured?",
        answer:
          "Pricing depends on your group size and features required.",
        category: "pricing-plans"
      },
      {
        question: "Can Habuks support multiple projects at once?",
        answer:
          "Yes. You can manage multiple projects and income activities under one group.",
        category: "growth-scale"
      },
      {
        question: "What happens as our group grows?",
        answer:
          "Habuks scales with you. You can add members and expand features as needed.",
        category: "growth-scale"
      },
      {
        question: "Does Habuks support audit-ready reports?",
        answer:
          "Yes. You can export reports for projects, welfare cycles, and finance with a clear audit trail.",
        category: "reports-audits"
      },
      {
        question: "How do we launch our hosted website?",
        answer:
          "Pick a template, add your branding, and publish. Habuks hosts the site and keeps it updated.",
        category: "hosted-website"
      }
    ],
    cta: null
  },
  pricingSection: {
    id: "pricing",
    kicker: "PRICING",
    title: "Pricing based on your needs",
    description: "Choose the plan that matches your group size and scale as you grow.",
    plans: [
      {
        name: "Starter",
        summary: "For new groups getting organized fast for faster impactin each ",
        price: "KSh 0",
        priceNote: "",
        badge: "30 days free trial",
        cta: {
          label: "Start free trial",
          href: "/get-started"
        },
        features: [
          "Member management",
          "Contribution tracking",
          "Project and IGA logs",
          "Basic reports",
          "Hosted website starter"
        ]
      },
      {
        name: "Growth",
        summary: "For growing teams that need deeper visibility.",
        price: "KSh 1,900",
        priceNote: "",
        badge: "30 days free trial",
        highlight: true,
        cta: {
          label: "Get started",
          href: "/get-started"
        },
        features: [
          "Includes all Starter features",
          "Up to 15 members",
          "KES 15 per month per extra member",
          "Advanced reporting",
          "Custom branding"
        ]
      },
      {
        name: "Pro",
        summary: "For large groups, SMEs or organizations with more members.",
        price: "KSh 2,900",
        priceNote: "",
        badge: "15 days free trial",
        cta: {
          label: "Get started",
          href: "/get-started"
        },
        features: [
          "Includes all Growth features",
          "Up to 20 members",
          "Priority support",
          "Audit-ready exports",
          "Custom workflows"
        ]
      }
    ]
  }
});
