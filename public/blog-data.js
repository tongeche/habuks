window.blogData = () => ({
  hero: {
    title: "Insights & Updates",
    subtitle: "Stay informed with the latest news, tips, and stories from the Habuks community.",
    stats: [
      { value: "50+", label: "Articles published" },
      { value: "10K+", label: "Monthly readers" },
      { value: "25+", label: "Community stories" }
    ]
  },
  featured: {
    id: "featured-1",
    category: "Product Updates",
    title: "Introducing the New Project Management Module",
    excerpt: "Streamline your community projects with our powerful new tools. Track milestones, assign tasks, and monitor budgets all in one place.",
    image: "/assets/blog-featured.jpg",
    author: {
      name: "Sarah Kimani",
      avatar: "/assets/avatar-1.webp",
      role: "Product Lead"
    },
    date: "February 20, 2026",
    readTime: "5 min read",
    href: "/blog/project-management-module"
  },
  categories: [
    { id: "all", label: "All Posts" },
    { id: "product", label: "Product Updates" },
    { id: "community", label: "Community Stories" },
    { id: "tips", label: "Tips & Guides" },
    { id: "news", label: "Company News" }
  ],
  posts: [
    {
      id: "post-1",
      category: "Community Stories",
      title: "How Mwangaza Group Increased Savings by 40%",
      excerpt: "Discover how this Nairobi-based chama transformed their financial management using Habuks.",
      image: "/assets/blog-1.jpg",
      author: {
        name: "James Ochieng",
        avatar: "/assets/avatar-2.webp"
      },
      date: "February 18, 2026",
      readTime: "4 min read",
      href: "/blog/mwangaza-success-story"
    },
    {
      id: "post-2",
      category: "Tips & Guides",
      title: "5 Best Practices for Managing Group Contributions",
      excerpt: "Learn proven strategies to ensure consistent contributions and build trust within your group.",
      image: "/assets/blog-2.jpg",
      author: {
        name: "Grace Wanjiku",
        avatar: "/assets/avatar-3.webp"
      },
      date: "February 15, 2026",
      readTime: "6 min read",
      href: "/blog/contribution-best-practices"
    },
    {
      id: "post-3",
      category: "Product Updates",
      title: "Mobile App: Now Available for Android",
      excerpt: "Access your group's financial data on the go with our brand new Android application.",
      image: "/assets/blog-3.jpg",
      author: {
        name: "Sarah Kimani",
        avatar: "/assets/avatar-1.webp"
      },
      date: "February 10, 2026",
      readTime: "3 min read",
      href: "/blog/android-app-launch"
    }
  ],
  newsletter: {
    title: "Subscribe to our newsletter",
    subtitle: "Get the latest articles and community updates delivered to your inbox.",
    placeholder: "Enter your email",
    buttonText: "Subscribe",
    disclaimer: "No spam. Unsubscribe anytime."
  }
});
