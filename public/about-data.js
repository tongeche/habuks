window.aboutData = () => ({
  // Hero Section
  hero: {
    image: {
      src: "/assets/about-hero.png",
      alt: "The Habuks team"
    }
  },

  // About Us Intro Section
  intro: {
    title: "About Us",
    paragraphs: [
      {
        text: "Founded in 2024, Habuks has quickly established itself as a reliable platform for <strong>multi-tenant community operations</strong>. We strive to make <strong>structured record-keeping accessible to everyone</strong>, from cooperatives and self-help groups to NGOs managing multiple community programs."
      },
      {
        text: "Our platform helps teams replace scattered spreadsheets and chat threads with organized workspaces, clear roles, and traceable records that make coordination easier and accountability built-in."
      }
    ]
  },

  // Mission Section
  mission: {
    title: "Our Mission",
    illustration: {
      src: "/assets/about-mission.svg",
      alt: "Our mission illustration"
    },
    paragraphs: [
      "We believe that community organizations deserve the same operational clarity that large enterprises have — without the complexity or cost.",
      "Our mission is to help teams across Africa and beyond bring structure to their daily operations, so they can focus on impact instead of chasing updates."
    ]
  },

  // Promise Section
  promise: {
    title: "Our Promise",
    text: "<strong>We are constantly</strong> improving the quality of our platform by <strong>listening to real operators</strong> and refining every workflow down to the last detail. Looking towards the future, we remain committed to pushing the boundaries in community operations while <strong>providing our users with unparalleled service quality.</strong> Sounds interesting? Why not join our journey:",
    image: {
      src: "/assets/about-promise.jpg",
      alt: "Team collaboration"
    },
    link: {
      label: "Join our team",
      href: "/careers"
    }
  },

  // Blog Section
  blog: {
    title: "Our Blog",
    description: "Get a feel for life at Habuks.",
    link: {
      label: "View all posts",
      href: "/blog"
    },
    featured: {
      title: "Building for Community Groups",
      image: "/assets/blog-featured.jpg",
      href: "/blog/building-for-community"
    },
    posts: [
      {
        title: "How we're supporting cooperative growth",
        image: "/assets/blog-1.jpg",
        href: "/blog/cooperative-growth"
      },
      {
        title: "Meet our team: Operations Lead",
        image: "/assets/blog-2.jpg",
        href: "/blog/meet-the-team"
      }
    ]
  },

  // Values Section
  values: {
    title: "What We Stand For",
    kicker: "OUR VALUES",
    items: [
      {
        title: "Clarity over complexity",
        description: "Teams should see what is happening and what comes next without needing a training manual.",
        icon: "eye"
      },
      {
        title: "Accountability built-in",
        description: "Every action leaves a trace so leaders, partners, and committees can trust the records.",
        icon: "shield"
      },
      {
        title: "Multi-tenant by default",
        description: "Each group gets its own workspace while admins keep visibility across portfolios.",
        icon: "layers"
      },
      {
        title: "Designed for real-world ops",
        description: "Habuks works for low-resource environments and growing organizations without heavy overhead.",
        icon: "settings"
      }
    ]
  },

  // Team Section
  team: {
    title: "Our Team",
    kicker: "THE PEOPLE",
    description: "A small, focused team building practical tools for community operations.",
    members: [
      {
        name: "Team Member",
        role: "Founder & Lead",
        image: "/assets/avatar-1.webp"
      },
      {
        name: "Team Member",
        role: "Product & Design",
        image: "/assets/avatar-2.webp"
      },
      {
        name: "Team Member",
        role: "Engineering",
        image: "/assets/avatar-3.webp"
      }
    ]
  },

  // CTA Section
  cta: {
    title: "Ready to bring structure to your community group?",
    description: "Join teams across Africa using Habuks to manage their operations with clarity.",
    primaryAction: {
      label: "Request a Demo",
      href: "/#contact"
    },
    secondaryAction: {
      label: "View Features",
      href: "/#modules"
    }
  }
});
