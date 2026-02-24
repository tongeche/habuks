window.resourcesData = () => ({
  hero: {
    title: "Learn Habuks",
    subtitle: "Master your organization management with our comprehensive courses and guides.",
    stats: [
      { value: "3+", label: "Courses" },
      { value: "2hrs", label: "Content" },
      { value: "95%", label: "Completion" }
    ]
  },
  categories: ["All", "Getting Started", "Finance", "Projects", "Members"],
  resources: [
    {
      slug: "getting-started",
      title: "Getting Started with Habuks",
      description: "Learn how to set up your organization and begin managing your records confidently.",
      category: "Getting Started",
      difficulty: "Beginner",
      chapters: 8,
      duration: "45 min",
      progress: 0,
      image: "/assets/course-getting-started.jpg",
      markdown: "/resources/getting-started.md",
      featured: true
    },
    {
      slug: "finance-guide",
      title: "Financial Records Best Practices",
      description: "How to properly record income, expenses, and maintain accurate financial records.",
      category: "Finance",
      difficulty: "Intermediate",
      chapters: 6,
      duration: "35 min",
      progress: 0,
      image: "/assets/course-finance.jpg",
      markdown: "/resources/finance-started.md",
      featured: true
    },
    {
      slug: "projects-guide",
      title: "Managing Projects & Budgets",
      description: "Create and track projects, set budgets, and monitor progress effectively.",
      category: "Projects",
      difficulty: "Intermediate",
      chapters: 5,
      duration: "30 min",
      progress: 0,
      image: "/assets/course-projects.jpg",
      markdown: "/resources/projects-started.md",
      featured: false
    }
  ]
});
