import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../icons.jsx";
import {
  createJppBatch,
  createJppBird,
  createJppDailyLog,
  createJppWeeklyGrowth,
  deleteJppBatch,
  deleteJppDailyLog,
  deleteJppWeeklyGrowth,
  getJppBatchKpis,
  getJppBatches,
  getJppBirds,
  getJppDailyLogs,
  getJppExpenses,
  getJppWeeklyGrowth,
  createProjectExpenseItem,
  getProjectProducts,
  getProjectExpenseItems,
  uploadBirdPhoto,
  updateProjectExpenseItem,
  updateJppBatch,
  updateJppDailyLog,
  updateJppWeeklyGrowth,
} from "../../lib/dataService.js";

const deathCauseOptions = [
  { value: "", label: "None" },
  { value: "U", label: "Unknown" },
  { value: "C", label: "Cold" },
  { value: "D", label: "Disease" },
  { value: "P", label: "Predator" },
  { value: "I", label: "Injury" },
  { value: "S", label: "Stress" },
];

const birdSexOptions = [
  { value: "unknown", label: "Unknown" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

const birdSourceOptions = [
  { value: "bought", label: "Bought" },
  { value: "hatched", label: "Hatched" },
  { value: "donated", label: "Donated" },
  { value: "transferred", label: "Transferred" },
];

const birdStatusOptions = [
  { value: "alive", label: "Alive" },
  { value: "sold", label: "Sold" },
  { value: "culled", label: "Culled" },
  { value: "dead", label: "Dead" },
  { value: "missing", label: "Missing" },
];

const birdAgeStageOptions = [
  { value: "unknown", label: "Unknown" },
  { value: "chick", label: "Chick" },
  { value: "pullet", label: "Pullet" },
  { value: "cockerel", label: "Cockerel" },
  { value: "hen", label: "Hen" },
  { value: "rooster", label: "Rooster" },
];

const dailyChecklistItems = ["Water", "Feed AM", "Feed PM", "Temp OK"];
const dailyRows = Array.from({ length: 7 }, (_, index) => index + 1);
const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const downloadDocs = [
  { key: "weekly", label: "Offline Weekly Sheet" },
  { key: "expenses", label: "Expense Log Sheet" },
  { key: "feed-inventory", label: "Feed Inventory Sheet" },
];

const toDateKey = (value) => {
  if (!value) return "";
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
};

export default function JppProjectPage({ user }) {
  const today = new Date().toISOString().slice(0, 10);
  const canManage = ["admin", "superadmin", "project_manager", "member"].includes(user?.role);

  const initialBatchForm = {
    batch_code: "",
    batch_name: "",
    start_date: today,
    supplier_name: "",
    supplier_contact: "",
    bird_type: "",
    breed: "",
    starting_count: "",
    avg_start_weight_kg: "",
    cost_birds: "",
    cost_transport: "",
    cost_initial_meds: "",
    feed_on_hand_kg: "",
    notes: "",
  };

  const initialDailyForm = {
    batch_id: "",
    log_date: today,
    water_clean_full_am: false,
    feed_given_am: false,
    feed_given_pm: false,
    droppings_normal: true,
    temp_vent_ok: true,
    cleaned_drinkers: false,
    cleaned_feeders: false,
    predator_check_done: false,
    alive_count: "",
    deaths_today: "",
    death_cause_code: "",
    feed_used_kg: "",
    water_refills: "",
    eggs_collected: "",
    money_spent: "",
    notes: "",
  };

  const initialWeeklyForm = {
    batch_id: "",
    week_ending: today,
    sample_size: "",
    avg_weight_kg: "",
    min_weight_kg: "",
    max_weight_kg: "",
    body_score_avg: "",
    feed_used_week_kg: "",
    meds_given: "",
    birds_sold: "",
    birds_culled: "",
    notes: "",
  };

  const initialBirdForm = {
    product_id: "",
    batch_id: "",
    tag_id: "",
    bird_name: "",
    sex: "unknown",
    breed_label: "unknown",
    color_label: "",
    pattern_label: "",
    age_stage: "unknown",
    hatch_date: "",
    acquired_date: today,
    acquired_source: "bought",
    status: "alive",
    status_date: today,
    description: "",
    notes: "",
  };

  const [activeTab, setActiveTab] = useState("overview");
  const [batches, setBatches] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [dailyLogs, setDailyLogs] = useState([]);
  const [weeklyGrowth, setWeeklyGrowth] = useState([]);
  const [birds, setBirds] = useState([]);
  const [birdProducts, setBirdProducts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [expenseItems, setExpenseItems] = useState([]);
  const [expenseItemEdits, setExpenseItemEdits] = useState({});
  const [savingExpenseItems, setSavingExpenseItems] = useState(false);
  const [addingExpenseItem, setAddingExpenseItem] = useState(false);
  const [moduleCounts, setModuleCounts] = useState({
    dailyLogs: 0,
    weeklyGrowth: 0,
    expenses: 0,
  });
  const [loading, setLoading] = useState(true);

  const [batchForm, setBatchForm] = useState(initialBatchForm);
  const [dailyForm, setDailyForm] = useState(initialDailyForm);
  const [weeklyForm, setWeeklyForm] = useState(initialWeeklyForm);
  const [birdForm, setBirdForm] = useState(initialBirdForm);
  const [birdPhoto, setBirdPhoto] = useState(null);
  const [birdPhotoPreview, setBirdPhotoPreview] = useState("");
  const [birdPhotoKey, setBirdPhotoKey] = useState(0);
  const [savingBird, setSavingBird] = useState(false);
  const [showBatchFormMobile, setShowBatchFormMobile] = useState(false);
  const [showDailyFormMobile, setShowDailyFormMobile] = useState(false);
  const [showBirdFormMobile, setShowBirdFormMobile] = useState(false);
  const [showWeeklyFormMobile, setShowWeeklyFormMobile] = useState(false);
  const [batchSearchTerm, setBatchSearchTerm] = useState("");
  const [batchFilter, setBatchFilter] = useState("active");
  const batchFormRef = useRef(null);
  const dailyFormRef = useRef(null);
  const birdFormRef = useRef(null);
  const weeklyFormRef = useRef(null);

  const [editingBatchId, setEditingBatchId] = useState(null);
  const [editingDailyId, setEditingDailyId] = useState(null);
  const [editingWeeklyId, setEditingWeeklyId] = useState(null);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedDailyDate, setSelectedDailyDate] = useState(null);
  const [printSheet, setPrintSheet] = useState("");
  const [selectedDownloadDoc, setSelectedDownloadDoc] = useState("");
  const [showDownloadPreview, setShowDownloadPreview] = useState(false);

  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const hasBatches = batches.length > 0;

  const handlePrint = (sheetKey) => {
    if (typeof window === "undefined") {
      return;
    }
    setPrintSheet(sheetKey);
    setTimeout(() => window.print(), 50);
  };

  const resetMessages = () => {
    setStatusMessage("");
    setErrorMessage("");
  };

  const loadJppData = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      resetMessages();
      const results = await Promise.allSettled([
        getJppBatches(),
        getJppBatchKpis(),
        getJppDailyLogs(),
        getJppWeeklyGrowth(),
        getJppExpenses(),
        getProjectExpenseItems("JPP"),
        getProjectProducts("JPP", { trackingMode: "individual" }),
        getJppBirds(),
      ]);

      const [
        batchRes,
        kpiRes,
        dailyRes,
        weeklyRes,
        expenseRes,
        expenseItemsRes,
        birdProductsRes,
        birdsRes,
      ] = results;

      const safeBatches = batchRes.status === "fulfilled" ? batchRes.value || [] : [];
      const safeKpis = kpiRes.status === "fulfilled" ? kpiRes.value || [] : [];
      const safeDaily = dailyRes.status === "fulfilled" ? dailyRes.value || [] : [];
      const safeWeekly = weeklyRes.status === "fulfilled" ? weeklyRes.value || [] : [];
      const safeExpenses = expenseRes.status === "fulfilled" ? expenseRes.value || [] : [];
      const safeExpenseItems =
        expenseItemsRes.status === "fulfilled" ? expenseItemsRes.value || [] : [];
      const safeBirdProducts =
        birdProductsRes.status === "fulfilled" ? birdProductsRes.value || [] : [];
      const safeBirds = birdsRes.status === "fulfilled" ? birdsRes.value || [] : [];

      const errors = results
        .filter((res) => res.status === "rejected")
        .map((res) => res.reason?.message || "Failed to load data.");

      setBatches(safeBatches);
      setKpis(safeKpis);
      setDailyLogs(safeDaily);
      setWeeklyGrowth(safeWeekly);
      setBirdProducts(safeBirdProducts);
      setBirds(safeBirds);
      setExpenses(safeExpenses);
      setExpenseItems(safeExpenseItems);
      setModuleCounts({
        dailyLogs: safeDaily.length,
        weeklyGrowth: safeWeekly.length,
        expenses: safeExpenses.length,
      });

      if (safeBatches.length > 0) {
        const selectedExists = safeBatches.some(
          (batch) => String(batch.id) === selectedBatchId
        );
        if (!selectedExists) {
          setSelectedBatchId(String(safeBatches[0].id));
        }
      } else if (selectedBatchId) {
        setSelectedBatchId("");
      }

      if (errors.length > 0) {
        setErrorMessage(errors.join(" "));
      }
    } catch (error) {
      console.error("Error loading JPP data:", error);
      setErrorMessage("Failed to load JPP data.");
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadJppData(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const handleAfterPrint = () => {
      setPrintSheet("");
    };
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  useEffect(() => {
    if (!birdPhoto) {
      setBirdPhotoPreview("");
      return undefined;
    }
    const previewUrl = URL.createObjectURL(birdPhoto);
    setBirdPhotoPreview(previewUrl);
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [birdPhoto]);

  useEffect(() => {
    if (birdProducts.length === 0) {
      return;
    }
    const selectionExists = birdProducts.some((product) => product.id === birdForm.product_id);
    if (!selectionExists) {
      setBirdForm((prev) => ({ ...prev, product_id: birdProducts[0].id }));
    }
  }, [birdProducts, birdForm.product_id]);

  const batchLookup = useMemo(() => {
    return new Map(batches.map((batch) => [String(batch.id), batch]));
  }, [batches]);

  const birdProductLookup = useMemo(() => {
    return new Map(birdProducts.map((product) => [product.id, product]));
  }, [birdProducts]);

  const selectedBatch = useMemo(() => {
    if (!selectedBatchId) {
      return null;
    }
    return batchLookup.get(selectedBatchId) || null;
  }, [batchLookup, selectedBatchId]);

  const expenseSheetItems = useMemo(() => {
    return expenseItems;
  }, [expenseItems]);

  const expenseSheetRowCount = useMemo(() => {
    return Math.max(8, expenseSheetItems.length);
  }, [expenseSheetItems.length]);

  const expenseSheetRows = useMemo(() => {
    return Array.from({ length: expenseSheetRowCount }, (_, index) => index);
  }, [expenseSheetRowCount]);

  const hasExpenseItemChanges = useMemo(() => {
    return expenseSheetItems.some((item) => {
      const nextLabel = (expenseItemEdits[item.id] ?? item.label ?? "").trim();
      const currentLabel = (item.label ?? "").trim();
      return nextLabel !== currentLabel;
    });
  }, [expenseItemEdits, expenseSheetItems]);

  useEffect(() => {
    setExpenseItemEdits((prev) => {
      const next = { ...prev };
      let hasChange = false;
      expenseItems.forEach((item) => {
        if (!Object.prototype.hasOwnProperty.call(next, item.id)) {
          next[item.id] = item.label || "";
          hasChange = true;
        }
      });
      return hasChange ? next : prev;
    });
  }, [expenseItems]);

  useEffect(() => {
    if (selectedDailyDate === null && dailyLogs.length > 0) {
      const nextDate = String(dailyLogs[0]?.log_date || "").slice(0, 10);
      if (nextDate) {
        setSelectedDailyDate(nextDate);
      }
    }
  }, [dailyLogs, selectedDailyDate]);

  const getBatchLabel = (batchId) => {
    if (!batchId) return "Unassigned";
    const batch = batchLookup.get(String(batchId));
    if (!batch) return "Unknown";
    return batch.batch_code || batch.batch_name || "Batch";
  };

  const getBatchStatus = (batch) => {
    const raw = String(
      batch?.status || batch?.batch_status || batch?.state || ""
    ).toLowerCase();
    if (["closed", "complete", "completed", "inactive", "ended", "archived"].includes(raw)) {
      return "closed";
    }
    if (["active", "open", "in_progress", "running"].includes(raw)) {
      return "active";
    }
    return "active";
  };

  const getBirdProductLabel = (productId) => {
    if (!productId) return "Unknown";
    const product = birdProductLookup.get(productId);
    if (!product) return "Unknown";
    return product.name || "Product";
  };

  const parseRequiredInteger = (value) => {
    if (value === "" || value === null || value === undefined) {
      return null;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const parseOptionalInteger = (value) => {
    if (value === "" || value === null || value === undefined) {
      return null;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const parseNumberOrZero = (value) => {
    if (value === "" || value === null || value === undefined) {
      return 0;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const parseOptionalNumber = (value) => {
    if (value === "" || value === null || value === undefined) {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const normalizeOptional = (value) => {
    if (value === undefined || value === null) {
      return null;
    }
    const trimmed = typeof value === "string" ? value.trim() : value;
    return trimmed === "" ? null : trimmed;
  };

  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatNumber = (value) => toNumber(value).toLocaleString("en-KE");
  const formatKg = (value) =>
    `${toNumber(value).toLocaleString("en-KE", { maximumFractionDigits: 1 })} kg`;
  const formatCurrency = (value) => `Ksh. ${toNumber(value).toLocaleString("en-KE")}`;
  const formatPercent = (value) => `${toNumber(value).toFixed(2)}%`;
  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };
  const formatLongDate = (dateStr) => {
    if (!dateStr) return "All daily logs";
    return new Date(dateStr).toLocaleDateString("en-KE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatOptional = (value, formatter) => {
    if (value === null || value === undefined || value === "") {
      return "-";
    }
    return formatter(value);
  };

  const formatLabel = (value) => {
    if (!value) {
      return "N/A";
    }
    const text = String(value).replace(/_/g, " ");
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  const getAgeDays = (dateStr) => {
    if (!dateStr) return null;
    const start = new Date(dateStr);
    if (Number.isNaN(start.getTime())) {
      return null;
    }
    const diff = Math.floor((new Date() - start) / (24 * 60 * 60 * 1000));
    return Math.max(diff, 0);
  };

  const getHealthStatus = (bird) => {
    const status = (bird.status || "").toLowerCase();
    if (["dead", "missing"].includes(status)) {
      return { label: "Needs attention", tone: "alert" };
    }
    if (status === "culled") {
      return { label: "Monitor health", tone: "warn" };
    }
    return { label: "Excellent health", tone: "good" };
  };

  const getMortalityRisk = (bird) => {
    const status = (bird.status || "").toLowerCase();
    if (["dead", "missing"].includes(status)) {
      return { label: "High", tone: "high" };
    }
    if (toNumber(bird.birds_culled_per_bird) > 0) {
      return { label: "Medium", tone: "medium" };
    }
    return { label: "Low", tone: "low" };
  };

  const totals = kpis.reduce(
    (acc, row) => {
      acc.starting += toNumber(row.starting_count);
      acc.deaths += toNumber(row.total_deaths);
      acc.alive += toNumber(row.estimated_alive_now);
      acc.feed += toNumber(row.total_feed_kg);
      acc.spend += toNumber(row.total_spend);
      return acc;
    },
    { starting: 0, deaths: 0, alive: 0, feed: 0, spend: 0 }
  );

  const mortalityPct = totals.starting ? (totals.deaths / totals.starting) * 100 : 0;
  const activeDailyDate = selectedDailyDate || today;

  const weekDates = useMemo(() => {
    const baseDate = new Date(activeDailyDate);
    if (Number.isNaN(baseDate.getTime())) {
      return [];
    }
    const dayIndex = baseDate.getDay();
    const mondayOffset = (dayIndex + 6) % 7;
    const monday = new Date(baseDate);
    monday.setDate(baseDate.getDate() - mondayOffset);
    return weekDayLabels.map((label, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return { label, day: date.getDate(), dateKey: toDateKey(date) };
    });
  }, [activeDailyDate]);

  const dailyLogsForMobile = useMemo(() => {
    if (!selectedDailyDate) return dailyLogs;
    return dailyLogs.filter((log) => toDateKey(log.log_date) === selectedDailyDate);
  }, [dailyLogs, selectedDailyDate]);

  const dailyEmptyState =
    dailyLogs.length === 0
      ? {
          title: "No daily logs yet",
          copy: "Start recording daily activity for each batch.",
        }
      : {
          title: "No logs for this day",
          copy: "Pick another day or add a log.",
        };
  const latestStartDate = batches.reduce((latest, batch) => {
    if (!batch.start_date) return latest;
    if (!latest) return batch.start_date;
    return new Date(batch.start_date) > new Date(latest) ? batch.start_date : latest;
  }, null);
  const filteredBatches = useMemo(() => {
    const term = batchSearchTerm.trim().toLowerCase();
    return batches.filter((batch) => {
      const status = getBatchStatus(batch);
      if (batchFilter !== "all" && status !== batchFilter) {
        return false;
      }
      if (!term) {
        return true;
      }
      const haystack = [
        batch.batch_code,
        batch.batch_name,
        batch.bird_type,
        batch.breed,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [batches, batchFilter, batchSearchTerm]);

  const batchSummaryKpis = useMemo(() => {
    if (!filteredBatches.length) {
      return [];
    }
    const codes = new Set(
      filteredBatches
        .map((batch) => String(batch.batch_code || batch.batch_name || ""))
        .filter(Boolean)
    );
    if (codes.size === 0) {
      return [];
    }
    return kpis.filter((row) => codes.has(String(row.batch_code || row.batch_name || "")));
  }, [filteredBatches, kpis]);

  const batchSummaryTotals = useMemo(() => {
    if (!filteredBatches.length) {
      return { starting: 0, deaths: 0, alive: 0, feed: 0, spend: 0 };
    }
    const source = batchSummaryKpis.length ? batchSummaryKpis : kpis;
    return source.reduce(
      (acc, row) => {
        acc.starting += toNumber(row.starting_count);
        acc.deaths += toNumber(row.total_deaths);
        acc.alive += toNumber(row.estimated_alive_now);
        acc.feed += toNumber(row.total_feed_kg);
        acc.spend += toNumber(row.total_spend);
        return acc;
      },
      { starting: 0, deaths: 0, alive: 0, feed: 0, spend: 0 }
    );
  }, [batchSummaryKpis, filteredBatches, kpis]);

  const batchSummaryMortality = batchSummaryTotals.starting
    ? (batchSummaryTotals.deaths / batchSummaryTotals.starting) * 100
    : 0;

  const batchFilterLabel =
    batchFilter === "active" ? "Active" : batchFilter === "closed" ? "Closed" : "All";

  const kpiLookup = useMemo(() => {
    const map = new Map();
    kpis.forEach((row) => {
      const key = String(row.batch_code || row.batch_name || "");
      if (key) {
        map.set(key, row);
      }
    });
    return map;
  }, [kpis]);

  const handleBatchChange = (event) => {
    const { name, value } = event.target;
    setBatchForm((prev) => ({ ...prev, [name]: value }));
    resetMessages();
  };

  const handleDailyChange = (event) => {
    const { name, value, type, checked } = event.target;
    setDailyForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    resetMessages();
  };

  const handleWeeklyChange = (event) => {
    const { name, value, type, checked } = event.target;
    setWeeklyForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    resetMessages();
  };

  const handleBirdChange = (event) => {
    const { name, value } = event.target;
    setBirdForm((prev) => ({ ...prev, [name]: value }));
    resetMessages();
  };

  const handleBirdPhotoChange = (event) => {
    const file = event.target.files?.[0] || null;
    setBirdPhoto(file);
  };

  const openBatchFormMobile = () => {
    setShowBatchFormMobile(true);
    if (typeof window !== "undefined") {
      setTimeout(() => {
        batchFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }
  };

  const closeBatchFormMobile = () => {
    setShowBatchFormMobile(false);
  };

  const openBirdFormMobile = () => {
    setShowBirdFormMobile(true);
    if (typeof window !== "undefined") {
      setTimeout(() => {
        birdFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }
  };

  const closeBirdFormMobile = () => {
    setShowBirdFormMobile(false);
  };

  const openDailyFormMobile = () => {
    setShowDailyFormMobile(true);
    if (typeof window !== "undefined") {
      setTimeout(() => {
        dailyFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }
  };

  const closeDailyFormMobile = () => {
    setShowDailyFormMobile(false);
  };

  const openWeeklyFormMobile = () => {
    setShowWeeklyFormMobile(true);
    if (typeof window !== "undefined") {
      setTimeout(() => {
        weeklyFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }
  };

  const closeWeeklyFormMobile = () => {
    setShowWeeklyFormMobile(false);
  };

  const handleDailyMobileCta = () => {
    if (!hasBatches) {
      setActiveTab("batches");
      openBatchFormMobile();
      return;
    }
    openDailyFormMobile();
  };

  const handleBatchSelect = (event) => {
    setSelectedBatchId(event.target.value);
  };

  const handleDownloadDocSelect = (event) => {
    setSelectedDownloadDoc(event.target.value);
    setShowDownloadPreview(false);
  };

  const handleExpenseItemChange = (itemId, value) => {
    setExpenseItemEdits((prev) => ({ ...prev, [itemId]: value }));
  };

  const handleExpenseItemsSave = async () => {
    if (!hasExpenseItemChanges || savingExpenseItems) {
      return;
    }

    const changes = expenseSheetItems
      .map((item) => ({
        id: item.id,
        nextLabel: (expenseItemEdits[item.id] ?? item.label ?? "").trim(),
        currentLabel: (item.label ?? "").trim(),
      }))
      .filter((change) => change.nextLabel !== change.currentLabel);

    if (changes.some((change) => !change.nextLabel)) {
      setErrorMessage("Expense item cannot be empty.");
      return;
    }

    try {
      resetMessages();
      setSavingExpenseItems(true);
      const results = await Promise.allSettled(
        changes.map((change) => updateProjectExpenseItem(change.id, { label: change.nextLabel }))
      );

      const updatedMap = new Map();
      const errors = [];
      results.forEach((result, index) => {
        const change = changes[index];
        if (result.status === "fulfilled") {
          updatedMap.set(change.id, result.value);
        } else {
          errors.push(result.reason?.message || "Failed to update an expense item.");
        }
      });

      if (updatedMap.size > 0) {
        setExpenseItems((prev) =>
          prev.map((item) => {
            const updated = updatedMap.get(item.id);
            return updated ? { ...item, label: updated.label || item.label } : item;
          })
        );
        setExpenseItemEdits((prev) => {
          const next = { ...prev };
          updatedMap.forEach((updated, id) => {
            next[id] = updated.label || next[id];
          });
          return next;
        });
      }

      if (errors.length > 0) {
        setErrorMessage(errors.join(" "));
      } else {
        setStatusMessage("Expense items updated.");
      }
    } catch (error) {
      console.error("Error updating expense items:", error);
      setErrorMessage("Failed to update expense items.");
    } finally {
      setSavingExpenseItems(false);
    }
  };

  const handleExpenseItemAdd = async () => {
    if (addingExpenseItem) {
      return;
    }

    try {
      resetMessages();
      setAddingExpenseItem(true);
      const existingLabels = new Set(
        expenseItems
          .map((item) => item.label)
          .filter(Boolean)
          .map((label) => label.trim().toLowerCase())
      );
      let counter = expenseItems.length + 1;
      let nextLabel = `New item ${counter}`;
      while (existingLabels.has(nextLabel.toLowerCase())) {
        counter += 1;
        nextLabel = `New item ${counter}`;
      }

      const created = await createProjectExpenseItem("JPP", {
        label: nextLabel,
        display_order: expenseItems.length + 1,
      });

      setExpenseItems((prev) => [...prev, created]);
      setExpenseItemEdits((prev) => ({ ...prev, [created.id]: created.label || nextLabel }));
      setStatusMessage("Expense item added.");
    } catch (error) {
      console.error("Error adding expense item:", error);
      setErrorMessage("Failed to add expense item.");
    } finally {
      setAddingExpenseItem(false);
    }
  };

  const handleDownloadView = () => {
    if (!selectedDownloadDoc) {
      return;
    }
    setShowDownloadPreview(true);
  };

  const handleDownloadPrint = () => {
    if (!selectedDownloadDoc) {
      return;
    }
    setShowDownloadPreview(true);
    handlePrint(selectedDownloadDoc);
  };

  const handleBatchSubmit = async (event) => {
    event.preventDefault();
    resetMessages();

    if (!batchForm.batch_code.trim()) {
      setErrorMessage("Batch code is required.");
      return;
    }

    if (!batchForm.start_date) {
      setErrorMessage("Start date is required.");
      return;
    }

    const startingCount = parseRequiredInteger(batchForm.starting_count);
    if (startingCount === null) {
      setErrorMessage("Starting count is required.");
      return;
    }

    const payload = {
      batch_code: batchForm.batch_code.trim(),
      batch_name: normalizeOptional(batchForm.batch_name),
      start_date: batchForm.start_date,
      supplier_name: normalizeOptional(batchForm.supplier_name),
      supplier_contact: normalizeOptional(batchForm.supplier_contact),
      bird_type: normalizeOptional(batchForm.bird_type),
      breed: normalizeOptional(batchForm.breed),
      starting_count: startingCount,
      avg_start_weight_kg: parseOptionalNumber(batchForm.avg_start_weight_kg),
      cost_birds: parseNumberOrZero(batchForm.cost_birds),
      cost_transport: parseNumberOrZero(batchForm.cost_transport),
      cost_initial_meds: parseNumberOrZero(batchForm.cost_initial_meds),
      feed_on_hand_kg: parseNumberOrZero(batchForm.feed_on_hand_kg),
      notes: normalizeOptional(batchForm.notes),
    };

    try {
      if (editingBatchId) {
        await updateJppBatch(editingBatchId, payload);
        setStatusMessage("Batch updated successfully.");
      } else {
        await createJppBatch(payload);
        setStatusMessage("Batch created successfully.");
      }
      setBatchForm(initialBatchForm);
      setEditingBatchId(null);
      setShowBatchFormMobile(false);
      await loadJppData(false);
    } catch (error) {
      setErrorMessage(error.message || "Failed to save batch.");
    }
  };

  const handleDailySubmit = async (event) => {
    event.preventDefault();
    resetMessages();

    if (!dailyForm.batch_id) {
      setErrorMessage("Select a batch for the daily log.");
      return;
    }

    if (!dailyForm.log_date) {
      setErrorMessage("Log date is required.");
      return;
    }

    const payload = {
      batch_id: dailyForm.batch_id,
      log_date: dailyForm.log_date,
      water_clean_full_am: dailyForm.water_clean_full_am,
      feed_given_am: dailyForm.feed_given_am,
      feed_given_pm: dailyForm.feed_given_pm,
      droppings_normal: dailyForm.droppings_normal,
      temp_vent_ok: dailyForm.temp_vent_ok,
      cleaned_drinkers: dailyForm.cleaned_drinkers,
      cleaned_feeders: dailyForm.cleaned_feeders,
      predator_check_done: dailyForm.predator_check_done,
      alive_count: parseOptionalInteger(dailyForm.alive_count),
      deaths_today: parseNumberOrZero(dailyForm.deaths_today),
      death_cause_code: normalizeOptional(dailyForm.death_cause_code),
      feed_used_kg: parseNumberOrZero(dailyForm.feed_used_kg),
      water_refills: parseNumberOrZero(dailyForm.water_refills),
      eggs_collected: parseNumberOrZero(dailyForm.eggs_collected),
      money_spent: parseNumberOrZero(dailyForm.money_spent),
      notes: normalizeOptional(dailyForm.notes),
    };

    try {
      if (editingDailyId) {
        await updateJppDailyLog(editingDailyId, payload);
        setStatusMessage("Daily log updated successfully.");
      } else {
        await createJppDailyLog(payload);
        setStatusMessage("Daily log added successfully.");
      }
      setDailyForm(initialDailyForm);
      setEditingDailyId(null);
      setShowDailyFormMobile(false);
      await loadJppData(false);
    } catch (error) {
      setErrorMessage(error.message || "Failed to save daily log.");
    }
  };

  const handleWeeklySubmit = async (event) => {
    event.preventDefault();
    resetMessages();

    if (!weeklyForm.batch_id) {
      setErrorMessage("Select a batch for weekly growth.");
      return;
    }

    if (!weeklyForm.week_ending) {
      setErrorMessage("Week ending date is required.");
      return;
    }

    const payload = {
      batch_id: weeklyForm.batch_id,
      week_ending: weeklyForm.week_ending,
      sample_size: parseNumberOrZero(weeklyForm.sample_size),
      avg_weight_kg: parseOptionalNumber(weeklyForm.avg_weight_kg),
      min_weight_kg: parseOptionalNumber(weeklyForm.min_weight_kg),
      max_weight_kg: parseOptionalNumber(weeklyForm.max_weight_kg),
      body_score_avg: parseOptionalNumber(weeklyForm.body_score_avg),
      feed_used_week_kg: parseNumberOrZero(weeklyForm.feed_used_week_kg),
      meds_given: normalizeOptional(weeklyForm.meds_given),
      birds_sold: parseNumberOrZero(weeklyForm.birds_sold),
      birds_culled: parseNumberOrZero(weeklyForm.birds_culled),
      notes: normalizeOptional(weeklyForm.notes),
    };

    try {
      if (editingWeeklyId) {
        await updateJppWeeklyGrowth(editingWeeklyId, payload);
        setStatusMessage("Weekly growth entry updated.");
      } else {
        await createJppWeeklyGrowth(payload);
        setStatusMessage("Weekly growth entry added.");
      }
      setWeeklyForm(initialWeeklyForm);
      setEditingWeeklyId(null);
      setShowWeeklyFormMobile(false);
      await loadJppData(false);
    } catch (error) {
      setErrorMessage(error.message || "Failed to save weekly growth.");
    }
  };

  const handleBirdSubmit = async (event) => {
    event.preventDefault();
    resetMessages();

    if (!birdForm.product_id) {
      setErrorMessage("Select a bird product.");
      return;
    }

    if (!birdForm.acquired_date) {
      setErrorMessage("Acquired date is required.");
      return;
    }

    setSavingBird(true);

    try {
      let photoPath = null;
      if (birdPhoto) {
        const upload = await uploadBirdPhoto(birdPhoto, { folder: "jpp" });
        photoPath = upload?.path || upload?.publicUrl || null;
      }

      const payload = {
        product_id: birdForm.product_id,
        batch_id: normalizeOptional(birdForm.batch_id),
        tag_id: normalizeOptional(birdForm.tag_id),
        bird_name: normalizeOptional(birdForm.bird_name),
        sex: birdForm.sex || "unknown",
        breed_label: normalizeOptional(birdForm.breed_label) || "unknown",
        color_label: normalizeOptional(birdForm.color_label),
        pattern_label: normalizeOptional(birdForm.pattern_label),
        age_stage: birdForm.age_stage || "unknown",
        hatch_date: normalizeOptional(birdForm.hatch_date),
        acquired_date: birdForm.acquired_date,
        acquired_source: birdForm.acquired_source || "bought",
        status: birdForm.status || "alive",
        status_date: birdForm.status_date || birdForm.acquired_date,
        photo_url: photoPath,
        notes: normalizeOptional(birdForm.notes),
        description: normalizeOptional(birdForm.description),
      };

      await createJppBird(payload);
      const resetDate = new Date().toISOString().slice(0, 10);
      const fallbackProductId = birdForm.product_id || birdProducts[0]?.id || "";
      setBirdForm({
        ...initialBirdForm,
        product_id: fallbackProductId,
        acquired_date: resetDate,
        status_date: resetDate,
      });
      setBirdPhoto(null);
      setBirdPhotoPreview("");
      setBirdPhotoKey((value) => value + 1);
      setStatusMessage("Bird added.");
      setShowBirdFormMobile(false);
      await loadJppData(false);
    } catch (error) {
      console.error("Error saving bird:", error);
      setErrorMessage(error.message || "Failed to save bird.");
    } finally {
      setSavingBird(false);
    }
  };

  const handleBatchEdit = (batch) => {
    setBatchForm({
      ...initialBatchForm,
      ...batch,
      start_date: batch.start_date || today,
      starting_count: batch.starting_count ?? "",
      avg_start_weight_kg: batch.avg_start_weight_kg ?? "",
      cost_birds: batch.cost_birds ?? "",
      cost_transport: batch.cost_transport ?? "",
      cost_initial_meds: batch.cost_initial_meds ?? "",
      feed_on_hand_kg: batch.feed_on_hand_kg ?? "",
      supplier_name: batch.supplier_name ?? "",
      supplier_contact: batch.supplier_contact ?? "",
      bird_type: batch.bird_type ?? "",
      breed: batch.breed ?? "",
      batch_name: batch.batch_name ?? "",
      notes: batch.notes ?? "",
    });
    setEditingBatchId(batch.id);
    setActiveTab("batches");
    resetMessages();
    openBatchFormMobile();
  };

  const handleDailyEdit = (log) => {
    setDailyForm({
      ...initialDailyForm,
      ...log,
      batch_id: log.batch_id ? String(log.batch_id) : "",
      log_date: log.log_date || today,
      death_cause_code: log.death_cause_code || "",
      alive_count: log.alive_count ?? "",
      deaths_today: log.deaths_today ?? "",
      feed_used_kg: log.feed_used_kg ?? "",
      water_refills: log.water_refills ?? "",
      eggs_collected: log.eggs_collected ?? "",
      money_spent: log.money_spent ?? "",
      notes: log.notes ?? "",
    });
    setEditingDailyId(log.id);
    setActiveTab("daily");
    resetMessages();
    openDailyFormMobile();
  };

  const handleWeeklyEdit = (entry) => {
    setWeeklyForm({
      ...initialWeeklyForm,
      ...entry,
      batch_id: entry.batch_id ? String(entry.batch_id) : "",
      week_ending: entry.week_ending || today,
      sample_size: entry.sample_size ?? "",
      avg_weight_kg: entry.avg_weight_kg ?? "",
      min_weight_kg: entry.min_weight_kg ?? "",
      max_weight_kg: entry.max_weight_kg ?? "",
      body_score_avg: entry.body_score_avg ?? "",
      feed_used_week_kg: entry.feed_used_week_kg ?? "",
      meds_given: entry.meds_given ?? "",
      birds_sold: entry.birds_sold ?? "",
      birds_culled: entry.birds_culled ?? "",
      notes: entry.notes ?? "",
    });
    setEditingWeeklyId(entry.id);
    setActiveTab("weekly");
    resetMessages();
    openWeeklyFormMobile();
  };

  const handleBatchDelete = async (batchId) => {
    if (!confirm("Delete this batch? This will remove related logs.")) {
      return;
    }
    resetMessages();
    try {
      await deleteJppBatch(batchId);
      setStatusMessage("Batch deleted.");
      await loadJppData(false);
    } catch (error) {
      setErrorMessage(error.message || "Failed to delete batch.");
    }
  };

  const handleDailyDelete = async (logId) => {
    if (!confirm("Delete this daily log?")) {
      return;
    }
    resetMessages();
    try {
      await deleteJppDailyLog(logId);
      setStatusMessage("Daily log deleted.");
      await loadJppData(false);
    } catch (error) {
      setErrorMessage(error.message || "Failed to delete daily log.");
    }
  };

  const handleWeeklyDelete = async (entryId) => {
    if (!confirm("Delete this weekly growth entry?")) {
      return;
    }
    resetMessages();
    try {
      await deleteJppWeeklyGrowth(entryId);
      setStatusMessage("Weekly growth entry deleted.");
      await loadJppData(false);
    } catch (error) {
      setErrorMessage(error.message || "Failed to delete weekly growth entry.");
    }
  };

  const handleBatchCancel = () => {
    setBatchForm(initialBatchForm);
    setEditingBatchId(null);
    setShowBatchFormMobile(false);
  };

  const handleDailyCancel = () => {
    setDailyForm(initialDailyForm);
    setEditingDailyId(null);
    setShowDailyFormMobile(false);
  };

  const handleWeeklyCancel = () => {
    setWeeklyForm(initialWeeklyForm);
    setEditingWeeklyId(null);
  };

  if (loading) {
    return (
      <div className="jpp-page">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading JPP project data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`jpp-page ${activeTab === "overview" ? "is-overview" : ""}`}>
      <div className="page-header">
        <div className="page-header-text">
          <h1>JPP Poultry Project</h1>
          <p>Track batches, daily logs, and growth.</p>
        </div>
        <div className="jpp-header-badges">
          <span className="jpp-badge">
            <Icon name="calendar" size={14} />
            {batches.length} batches
          </span>
          <span className="jpp-badge">
            <Icon name="users" size={14} />
            {formatNumber(totals.alive)} birds
          </span>
        </div>
      </div>

      {(statusMessage || errorMessage) && (
        <div className={`admin-alert ${errorMessage ? "is-error" : "is-success"}`}>
          <span>{errorMessage || statusMessage}</span>
        </div>
      )}

      <div className="jpp-tabs">
        <button
          className={`jpp-tab ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
          type="button"
        >
          <Icon name="home" size={16} />
          Overview
        </button>
        <button
          className={`jpp-tab ${activeTab === "batches" ? "active" : ""}`}
          onClick={() => setActiveTab("batches")}
          type="button"
        >
          <Icon name="folder" size={16} />
          Batches
        </button>
        <button
          className={`jpp-tab ${activeTab === "daily" ? "active" : ""}`}
          onClick={() => setActiveTab("daily")}
          type="button"
        >
          <Icon name="check-circle" size={16} />
          Daily Logs
        </button>
        <button
          className={`jpp-tab ${activeTab === "weekly" ? "active" : ""}`}
          onClick={() => setActiveTab("weekly")}
          type="button"
        >
          <Icon name="calendar" size={16} />
          Weekly Growth
        </button>
        <button
          className={`jpp-tab ${activeTab === "birds" ? "active" : ""}`}
          onClick={() => setActiveTab("birds")}
          type="button"
        >
          <Icon name="users" size={16} />
          Birds
        </button>
        {canManage && (
          <button
            className={`jpp-tab jpp-tab-downloads ${activeTab === "downloads" ? "active" : ""}`}
            onClick={() => setActiveTab("downloads")}
            type="button"
          >
            <Icon name="folder" size={16} />
            Downloads
          </button>
        )}
      </div>

      {activeTab === "overview" && (
        <>
          <div className="jpp-mobile-overview">
            <div className="jpp-mobile-hero">
              <div className="jpp-mobile-hero-media">
                <img
                  src="/assets/jpp_farm-bg.png"
                  alt="JPP poultry project"
                  loading="lazy"
                />
                <div className="jpp-mobile-hero-overlay">
                  <div className="jpp-mobile-hero-top">
                    <span className="jpp-mobile-hero-pill">
                      <Icon name="location" size={14} />
                      JPP Poultry Farm
                    </span>
                    <span className="jpp-mobile-hero-pill is-muted">
                      <Icon name="calendar" size={14} />
                      {formatDate(today)}
                    </span>
                  </div>
                  <div className="jpp-mobile-hero-status">
                    <span className="jpp-mobile-hero-status-pill">
                      <Icon name="trending-up" size={14} />
                      Stable growth
                    </span>
                  </div>
                </div>
              </div>
              <div className="jpp-mobile-project-card">
                <div className="jpp-mobile-project-header">
                  <h2>JPP Poultry Project</h2>
                  <span className="jpp-mobile-project-chip">
                    <Icon name="check-circle" size={14} />
                    Active
                  </span>
                </div>
                <p>Track batches, daily logs, and growth.</p>
                <div className="jpp-mobile-project-meta">
                  <span>
                    <Icon name="folder" size={14} />
                    {formatNumber(batches.length)} batches
                  </span>
                  <span>
                    <Icon name="users" size={14} />
                    {formatNumber(totals.alive)} birds
                  </span>
                  <span>
                    <Icon name="calendar" size={14} />
                    Latest start {latestStartDate ? formatDate(latestStartDate) : "N/A"}
                  </span>
                </div>
              </div>
            </div>
            <div className="jpp-mobile-stat-grid">
              <div className="jpp-mobile-stat-card">
                <span className="jpp-mobile-stat-icon tone-blue">
                  <Icon name="folder" size={18} />
                </span>
                <span className="jpp-mobile-stat-value">{formatNumber(batches.length)}</span>
                <span className="jpp-mobile-stat-label">Batches</span>
              </div>
              <div className="jpp-mobile-stat-card">
                <span className="jpp-mobile-stat-icon tone-amber">
                  <Icon name="trending-up" size={18} />
                </span>
                <span className="jpp-mobile-stat-value">{formatPercent(mortalityPct)}</span>
                <span className="jpp-mobile-stat-label">Mortality</span>
              </div>
              <div className="jpp-mobile-stat-card">
                <span className="jpp-mobile-stat-icon tone-emerald">
                  <Icon name="receipt" size={18} />
                </span>
                <span className="jpp-mobile-stat-value">{formatKg(totals.feed)}</span>
                <span className="jpp-mobile-stat-label">Feed Used</span>
              </div>
            </div>
          </div>
          <div className="jpp-modern-summary-grid">
            <div className="jpp-modern-card batches">
              <div className="jpp-modern-icon" style={{background: 'linear-gradient(135deg, #60a5fa, #3b82f6)'}}>
                <Icon name="folder" size={28} />
              </div>
              <div className="jpp-modern-content">
                <span className="jpp-modern-label">Batches</span>
                <span className="jpp-modern-value">{formatNumber(batches.length)}</span>
                <span className="jpp-modern-sub">Latest start: {latestStartDate ? formatDate(latestStartDate) : "N/A"}</span>
              </div>
            </div>
            <div className="jpp-modern-card alive">
              <div className="jpp-modern-icon" style={{background: 'linear-gradient(135deg, #10b981, #059669)'}}>
                <span role="img" aria-label="chicken">🐔</span>
              </div>
              <div className="jpp-modern-content">
                <span className="jpp-modern-label">Alive</span>
                <span className="jpp-modern-value">{formatNumber(totals.alive)}</span>
                <span className="jpp-modern-sub">Mortality: <span style={{color:'#ef4444'}}>{formatPercent(mortalityPct)}</span></span>
              </div>
            </div>
            <div className="jpp-modern-card feed">
              <div className="jpp-modern-icon" style={{background: 'linear-gradient(135deg, #fbbf24, #f59e0b)'}}>
                <span role="img" aria-label="feed">🌾</span>
              </div>
              <div className="jpp-modern-content">
                <span className="jpp-modern-label">Total Feed</span>
                <span className="jpp-modern-value">{formatKg(totals.feed)}</span>
                <span className="jpp-modern-sub">From daily logs</span>
              </div>
            </div>
          </div>


        </>
      )}

      {activeTab === "downloads" && canManage && (
        <section className="jpp-section">
          <div className="section-header">
            <h3>
              <Icon name="folder" size={18} /> Documents
            </h3>
          </div>

          <div className="admin-card jpp-download-panel">
            <div className="jpp-download-header">
              <div>
                <h4>Documents</h4>
                <p className="admin-help">Pick a document and then view or print it.</p>
              </div>
              <div className="jpp-download-actions">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={handleDownloadView}
                  disabled={!selectedDownloadDoc}
                >
                  <Icon name="search" size={16} />
                  View document
                </button>
                <button
                  className="btn-primary"
                  type="button"
                  onClick={handleDownloadPrint}
                  disabled={!selectedDownloadDoc}
                >
                  <Icon name="receipt" size={16} />
                  Print / Save PDF
                </button>
              </div>
            </div>

            <div className="jpp-download-controls">
              <div className="admin-form-field">
                <label>Document</label>
                <select value={selectedDownloadDoc} onChange={handleDownloadDocSelect}>
                  <option value="">Select document</option>
                  {downloadDocs.map((doc) => (
                    <option key={doc.key} value={doc.key}>
                      {doc.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="admin-form-field">
                <label>Batch Code</label>
                <select
                  value={selectedBatchId}
                  onChange={handleBatchSelect}
                  disabled={!hasBatches}
                >
                  <option value="">{hasBatches ? "Select batch" : "No batches yet"}</option>
                  {batches.map((batch) => (
                    <option key={`batch-code-${batch.id}`} value={String(batch.id)}>
                      {batch.batch_code || `Batch ${batch.id}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="admin-form-field">
                <label>Batch Name</label>
                <select
                  value={selectedBatchId}
                  onChange={handleBatchSelect}
                  disabled={!hasBatches}
                >
                  <option value="">{hasBatches ? "Select batch" : "No batches yet"}</option>
                  {batches.map((batch) => (
                    <option key={`batch-name-${batch.id}`} value={String(batch.id)}>
                      {batch.batch_name || batch.batch_code || `Batch ${batch.id}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!selectedDownloadDoc || !showDownloadPreview ? (
              <div className="jpp-download-empty">
                <div className="jpp-empty-icon">
                  <Icon name="alert" size={20} />
                </div>
                <h4>No document selected</h4>
                <p>Select a document above, then click View or Print.</p>
              </div>
            ) : (
              <div className="jpp-download-preview">
                {selectedDownloadDoc === "weekly" && (
                  <div
                    className={`jpp-print-sheet${printSheet === "weekly" ? " is-print" : ""}`}
                    aria-label="JPP Layers Weekly Sheet"
                  >
                    <div className="jpp-sheet-header">
                      <div>
                        <h2 className="jpp-sheet-title">JPP Layers - Weekly</h2>
                        <p className="jpp-sheet-subtitle">
                          Weekly checklist (tick what is done).
                        </p>
                      </div>
                      <div className="jpp-sheet-meta">
                        <div className="jpp-sheet-field">
                          <span>Week Ending</span>
                          <div className="jpp-sheet-line"></div>
                        </div>
                        <div className="jpp-sheet-field">
                          <span>Feed Unit</span>
                          <div className="jpp-sheet-line jpp-sheet-line--filled">kg</div>
                        </div>
                        <div className="jpp-sheet-field">
                          <span>Recorded By</span>
                          <div className="jpp-sheet-line"></div>
                        </div>
                      </div>
                    </div>

                    <div className="jpp-sheet-row jpp-sheet-row--compact">
                      <div className="jpp-sheet-field">
                        <span>Batch Code</span>
                        <div
                          className={`jpp-sheet-line${
                            selectedBatch?.batch_code ? " jpp-sheet-line--filled" : ""
                          }`}
                        >
                          {selectedBatch?.batch_code || ""}
                        </div>
                      </div>
                      <div className="jpp-sheet-field">
                        <span>Batch Name</span>
                        <div
                          className={`jpp-sheet-line${
                            selectedBatch?.batch_name ? " jpp-sheet-line--filled" : ""
                          }`}
                        >
                          {selectedBatch?.batch_name || ""}
                        </div>
                      </div>
                      <div className="jpp-sheet-field">
                        <span>Start Date</span>
                        <div
                          className={`jpp-sheet-line${
                            selectedBatch?.start_date ? " jpp-sheet-line--filled" : ""
                          }`}
                        >
                          {selectedBatch?.start_date ? formatDate(selectedBatch.start_date) : ""}
                        </div>
                      </div>
                    </div>

                    <div className="jpp-sheet-section">
                      <h3 className="jpp-sheet-section-title">Daily Checks</h3>
                      <p className="jpp-sheet-key">Tick the box when done.</p>
                      <table className="jpp-sheet-table jpp-sheet-table--simple">
                        <thead>
                          <tr>
                            <th>Day</th>
                            <th>Date</th>
                            {dailyChecklistItems.map((item) => (
                              <th key={`daily-col-${item}`}>{item}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dailyRows.map((row, index) => (
                            <tr key={`daily-row-${row}`}>
                              <td>{weekDayLabels[index]}</td>
                              <td>
                                <div className="jpp-sheet-blank"></div>
                              </td>
                              {dailyChecklistItems.map((item) => (
                                <td key={`${row}-${item}`}>
                                  <div className="jpp-sheet-box"></div>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="jpp-sheet-section">
                      <h3 className="jpp-sheet-section-title">Notes / Totals</h3>
                      <div className="jpp-sheet-notes">
                        <div className="jpp-sheet-line"></div>
                        <div className="jpp-sheet-line"></div>
                        <div className="jpp-sheet-line"></div>
                      </div>
                    </div>

                    <div className="jpp-sheet-section jpp-sheet-signoff">
                      <div className="jpp-sheet-field">
                        <span>Manager Signature</span>
                        <div className="jpp-sheet-line"></div>
                      </div>
                      <div className="jpp-sheet-field">
                        <span>Date Submitted</span>
                        <div className="jpp-sheet-line"></div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedDownloadDoc === "expenses" && (
                  <div
                    className={`jpp-print-sheet${printSheet === "expenses" ? " is-print" : ""}`}
                    aria-label="JPP Expense Log Sheet"
                  >
                    <div className="jpp-sheet-header">
                      <div>
                        <h2 className="jpp-sheet-title">JPP Expense Log - Weekly</h2>
                        <p className="jpp-sheet-subtitle">
                          Write each expense and tick receipt.
                        </p>
                      </div>
                      <div className="jpp-sheet-meta">
                        <div className="jpp-sheet-field">
                          <span>Week Ending</span>
                          <div className="jpp-sheet-line"></div>
                        </div>
                        <div className="jpp-sheet-field">
                          <span>Recorded By</span>
                          <div className="jpp-sheet-line"></div>
                        </div>
                      </div>
                    </div>

                    <div className="jpp-sheet-row jpp-sheet-row--compact">
                      <div className="jpp-sheet-field">
                        <span>Batch Code</span>
                        <div
                          className={`jpp-sheet-line${
                            selectedBatch?.batch_code ? " jpp-sheet-line--filled" : ""
                          }`}
                        >
                          {selectedBatch?.batch_code || ""}
                        </div>
                      </div>
                      <div className="jpp-sheet-field">
                        <span>Batch Name</span>
                        <div
                          className={`jpp-sheet-line${
                            selectedBatch?.batch_name ? " jpp-sheet-line--filled" : ""
                          }`}
                        >
                          {selectedBatch?.batch_name || ""}
                        </div>
                      </div>
                    </div>

                    <div className="jpp-sheet-section">
                      <div className="jpp-sheet-actions jpp-no-print">
                        <button
                          className="btn-secondary"
                          type="button"
                          onClick={handleExpenseItemAdd}
                          disabled={addingExpenseItem}
                        >
                          <Icon name="plus" size={16} />
                          {addingExpenseItem ? "Adding..." : "Add Item"}
                        </button>
                        <button
                          className="btn-secondary"
                          type="button"
                          onClick={handleExpenseItemsSave}
                          disabled={!hasExpenseItemChanges || savingExpenseItems}
                        >
                          <Icon name="check" size={16} />
                          {savingExpenseItems ? "Saving..." : "Save Items"}
                        </button>
                      </div>
                      <table className="jpp-sheet-table jpp-sheet-table--expense">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Item</th>
                            <th>Amount</th>
                            <th>Vendor</th>
                            <th>Receipt</th>
                          </tr>
                        </thead>
                        <tbody>
                          {expenseSheetRows.map((row) => {
                            const item = expenseSheetItems[row];
                            const itemLabel = item
                              ? expenseItemEdits[item.id] ?? item.label ?? ""
                              : "";
                            return (
                              <tr key={`expense-row-${row + 1}`}>
                                <td>
                                  <div className="jpp-sheet-blank"></div>
                                </td>
                                <td>
                                  {item ? (
                                    <input
                                      className="jpp-sheet-input"
                                      value={itemLabel}
                                      onChange={(event) =>
                                        handleExpenseItemChange(item.id, event.target.value)
                                      }
                                    />
                                  ) : (
                                    <div className="jpp-sheet-blank"></div>
                                  )}
                                </td>
                                <td>
                                  <div className="jpp-sheet-blank"></div>
                                </td>
                                <td>
                                  <div className="jpp-sheet-blank"></div>
                                </td>
                                <td>
                                  <div className="jpp-sheet-box"></div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="jpp-sheet-row jpp-sheet-row--compact">
                      <div className="jpp-sheet-field">
                        <span>Total Amount</span>
                        <div className="jpp-sheet-line"></div>
                      </div>
                    </div>

                    <div className="jpp-sheet-section jpp-sheet-signoff">
                      <div className="jpp-sheet-field">
                        <span>Manager Signature</span>
                        <div className="jpp-sheet-line"></div>
                      </div>
                      <div className="jpp-sheet-field">
                        <span>Date Submitted</span>
                        <div className="jpp-sheet-line"></div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedDownloadDoc === "feed-inventory" && (
                  <div
                    className={`jpp-print-sheet${
                      printSheet === "feed-inventory" ? " is-print" : ""
                    }`}
                    aria-label="JPP Feed Inventory Sheet"
                  >
                    <div className="jpp-sheet-header">
                      <div>
                        <h2 className="jpp-sheet-title">JPP Feed Inventory - Weekly</h2>
                        <p className="jpp-sheet-subtitle">
                          Track opening stock, deliveries, usage, and closing stock.
                        </p>
                      </div>
                      <div className="jpp-sheet-meta">
                        <div className="jpp-sheet-field">
                          <span>Week Ending</span>
                          <div className="jpp-sheet-line"></div>
                        </div>
                        <div className="jpp-sheet-field">
                          <span>Feed Unit</span>
                          <div className="jpp-sheet-line jpp-sheet-line--filled">kg</div>
                        </div>
                        <div className="jpp-sheet-field">
                          <span>Recorded By</span>
                          <div className="jpp-sheet-line"></div>
                        </div>
                      </div>
                    </div>

                    <div className="jpp-sheet-row jpp-sheet-row--compact">
                      <div className="jpp-sheet-field">
                        <span>Batch Code</span>
                        <div
                          className={`jpp-sheet-line${
                            selectedBatch?.batch_code ? " jpp-sheet-line--filled" : ""
                          }`}
                        >
                          {selectedBatch?.batch_code || ""}
                        </div>
                      </div>
                      <div className="jpp-sheet-field">
                        <span>Batch Name</span>
                        <div
                          className={`jpp-sheet-line${
                            selectedBatch?.batch_name ? " jpp-sheet-line--filled" : ""
                          }`}
                        >
                          {selectedBatch?.batch_name || ""}
                        </div>
                      </div>
                    </div>

                    <div className="jpp-sheet-section">
                      <table className="jpp-sheet-table jpp-sheet-table--inventory">
                        <thead>
                          <tr>
                            <th>Day</th>
                            <th>Date</th>
                            <th>Opening Stock (kg)</th>
                            <th>Deliveries (kg)</th>
                            <th>Daily Usage (kg)</th>
                            <th>Closing Stock (kg)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dailyRows.map((row, index) => (
                            <tr key={`inventory-row-${row}`}>
                              <td>{weekDayLabels[index]}</td>
                              <td>
                                <div className="jpp-sheet-blank"></div>
                              </td>
                              <td>
                                <div className="jpp-sheet-blank"></div>
                              </td>
                              <td>
                                <div className="jpp-sheet-blank"></div>
                              </td>
                              <td>
                                <div className="jpp-sheet-blank"></div>
                              </td>
                              <td>
                                <div className="jpp-sheet-blank"></div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="jpp-sheet-section jpp-sheet-signoff">
                      <div className="jpp-sheet-field">
                        <span>Manager Signature</span>
                        <div className="jpp-sheet-line"></div>
                      </div>
                      <div className="jpp-sheet-field">
                        <span>Date Submitted</span>
                        <div className="jpp-sheet-line"></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "batches" && (
        <div className="jpp-tab-grid jpp-batches-layout">
          <div
            className={`admin-card jpp-batch-form-card ${showBatchFormMobile ? "is-open" : ""}`}
            ref={batchFormRef}
          >
            <div className="section-header jpp-batch-form-header">
              <h3>{editingBatchId ? "Edit Batch" : "Add Batch"}</h3>
              <button
                type="button"
                className="jpp-batch-form-toggle"
                onClick={showBatchFormMobile ? closeBatchFormMobile : openBatchFormMobile}
              >
                {showBatchFormMobile ? "Hide form" : "Add batch"}
              </button>
            </div>
            <form className="admin-form" onSubmit={handleBatchSubmit}>
              <div className="admin-form-grid">
                <div className="admin-form-field">
                  <label>Batch Code *</label>
                  <input
                    name="batch_code"
                    value={batchForm.batch_code}
                    onChange={handleBatchChange}
                    placeholder="JPP-2026-01-A"
                  />
                </div>
                <div className="admin-form-field">
                  <label>Batch Name</label>
                  <input
                    name="batch_name"
                    value={batchForm.batch_name}
                    onChange={handleBatchChange}
                    placeholder="Brooder A"
                  />
                </div>
                <div className="admin-form-field">
                  <label>Start Date *</label>
                  <input
                    type="date"
                    name="start_date"
                    value={batchForm.start_date}
                    onChange={handleBatchChange}
                  />
                </div>
                <div className="admin-form-field">
                  <label>Bird Type</label>
                  <input
                    name="bird_type"
                    value={batchForm.bird_type}
                    onChange={handleBatchChange}
                    placeholder="Broiler"
                  />
                </div>
                <div className="admin-form-field">
                  <label>Breed</label>
                  <input
                    name="breed"
                    value={batchForm.breed}
                    onChange={handleBatchChange}
                    placeholder="Kuroiler"
                  />
                </div>
                <div className="admin-form-field">
                  <label>Starting Count *</label>
                  <input
                    type="number"
                    min="0"
                    name="starting_count"
                    value={batchForm.starting_count}
                    onChange={handleBatchChange}
                  />
                </div>
                <div className="admin-form-field">
                  <label>Avg Start Weight (kg)</label>
                  <input
                    type="number"
                    step="0.001"
                    name="avg_start_weight_kg"
                    value={batchForm.avg_start_weight_kg}
                    onChange={handleBatchChange}
                  />
                </div>
                <div className="admin-form-field">
                  <label>Feed on Hand (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="feed_on_hand_kg"
                    value={batchForm.feed_on_hand_kg}
                    onChange={handleBatchChange}
                  />
                </div>
                <div className="admin-form-field">
                  <label>Supplier Name</label>
                  <input
                    name="supplier_name"
                    value={batchForm.supplier_name}
                    onChange={handleBatchChange}
                  />
                </div>
                <div className="admin-form-field">
                  <label>Supplier Contact</label>
                  <input
                    name="supplier_contact"
                    value={batchForm.supplier_contact}
                    onChange={handleBatchChange}
                  />
                </div>
                <div className="admin-form-field">
                  <label>Cost - Birds</label>
                  <input
                    type="number"
                    step="0.01"
                    name="cost_birds"
                    value={batchForm.cost_birds}
                    onChange={handleBatchChange}
                  />
                </div>
                <div className="admin-form-field">
                  <label>Cost - Transport</label>
                  <input
                    type="number"
                    step="0.01"
                    name="cost_transport"
                    value={batchForm.cost_transport}
                    onChange={handleBatchChange}
                  />
                </div>
                <div className="admin-form-field">
                  <label>Cost - Initial Meds</label>
                  <input
                    type="number"
                    step="0.01"
                    name="cost_initial_meds"
                    value={batchForm.cost_initial_meds}
                    onChange={handleBatchChange}
                  />
                </div>
                <div className="admin-form-field admin-form-field--full">
                  <label>Notes</label>
                  <textarea
                    name="notes"
                    value={batchForm.notes}
                    onChange={handleBatchChange}
                    rows={3}
                  />
                </div>
              </div>
              <div className="admin-form-actions">
                <button className="btn-primary" type="submit">
                  {editingBatchId ? "Save Changes" : "Add Batch"}
                </button>
                {editingBatchId && (
                  <button className="btn-secondary" type="button" onClick={handleBatchCancel}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="admin-card jpp-batch-list-card">
            <div className="section-header jpp-batch-list-header">
              <h3>
                <Icon name="folder" size={18} /> Batch List
              </h3>
              <button type="button" className="jpp-batch-add-btn" onClick={openBatchFormMobile}>
                <Icon name="plus" size={16} />
                Add batch
              </button>
            </div>
            {batches.length === 0 ? (
              <div className="empty-state">
                <Icon name="folder" size={40} />
                <h3>No batches yet</h3>
                <p>Add the first batch to start tracking.</p>
              </div>
            ) : (
              <>
                <div className="jpp-batches-mobile">
                  <div className="jpp-batch-controls">
                    <div className="jpp-batch-search">
                      <Icon name="search" size={18} />
                      <input
                        type="search"
                        placeholder="Search batch code/name"
                        value={batchSearchTerm}
                        onChange={(event) => setBatchSearchTerm(event.target.value)}
                      />
                      <span className="jpp-batch-search-divider" aria-hidden="true" />
                      <button
                        type="button"
                        className="jpp-batch-search-filter"
                        aria-label="Filter batches"
                      >
                        <Icon name="filter" size={18} />
                      </button>
                    </div>
                    <div className="jpp-batch-filter-row">
                      <div className="jpp-batch-filter-tabs" role="tablist" aria-label="Batch status">
                        <button
                          type="button"
                          className={`jpp-batch-filter${batchFilter === "active" ? " is-active" : ""}`}
                          onClick={() => setBatchFilter("active")}
                          role="tab"
                          aria-selected={batchFilter === "active"}
                        >
                          <Icon name="user" size={14} />
                          Active
                        </button>
                        <button
                          type="button"
                          className={`jpp-batch-filter${batchFilter === "closed" ? " is-active" : ""}`}
                          onClick={() => setBatchFilter("closed")}
                          role="tab"
                          aria-selected={batchFilter === "closed"}
                        >
                          <Icon name="check-circle" size={14} />
                          Closed
                        </button>
                        <button
                          type="button"
                          className={`jpp-batch-filter${batchFilter === "all" ? " is-active" : ""}`}
                          onClick={() => setBatchFilter("all")}
                          role="tab"
                          aria-selected={batchFilter === "all"}
                        >
                          All
                        </button>
                      </div>
                      <button type="button" className="jpp-batch-new-btn" onClick={openBatchFormMobile}>
                        <Icon name="plus" size={16} />
                        New batch
                      </button>
                    </div>
                  </div>
                  <div className="jpp-batch-summary">
                    <div className="jpp-batch-summary-header">
                      <h4>{batchFilterLabel} Batches</h4>
                      <button
                        type="button"
                        className="jpp-batch-more-btn"
                        aria-label="Batch summary options"
                      >
                        <Icon name="more-horizontal" size={18} />
                      </button>
                    </div>
                    <div className="jpp-batch-summary-grid">
                      <div className="jpp-batch-summary-item tone-emerald">
                        <span className="jpp-batch-summary-icon">
                          <Icon name="feather" size={16} />
                        </span>
                        <div>
                          <span className="jpp-batch-summary-value">
                            {formatNumber(batchSummaryTotals.alive)}
                          </span>
                          <span className="jpp-batch-summary-label">Birds</span>
                        </div>
                      </div>
                      <div className="jpp-batch-summary-item tone-amber">
                        <span className="jpp-batch-summary-icon">
                          <Icon name="receipt" size={16} />
                        </span>
                        <div>
                          <span className="jpp-batch-summary-value">
                            {formatKg(batchSummaryTotals.feed)}
                          </span>
                          <span className="jpp-batch-summary-label">Feed Used</span>
                        </div>
                      </div>
                      <div className="jpp-batch-summary-item tone-rose">
                        <span className="jpp-batch-summary-icon">
                          <Icon name="heart" size={16} />
                        </span>
                        <div>
                          <span className="jpp-batch-summary-value">
                            {`${toNumber(batchSummaryMortality).toFixed(0)}%`}
                          </span>
                          <span className="jpp-batch-summary-label">Mortality</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="jpp-batch-card-grid">
                    {filteredBatches.length === 0 ? (
                      <div className="jpp-batch-empty">
                        <h4>No batches found</h4>
                        <p>Try adjusting the search or filter.</p>
                      </div>
                    ) : (
                      filteredBatches.map((batch) => {
                      const birdType = [batch.bird_type, batch.breed].filter(Boolean).join(" · ");
                      const status = getBatchStatus(batch);
                      const displayName = batch.batch_name || batch.batch_code || "Batch";
                      const displayCode =
                        batch.batch_name && batch.batch_code ? batch.batch_code : "";
                      const kpi = kpiLookup.get(
                        String(batch.batch_code || batch.batch_name || "")
                      );
                      const aliveCount =
                        kpi?.estimated_alive_now ?? toNumber(batch.starting_count);
                      const feedUsed = kpi?.total_feed_kg ?? toNumber(batch.feed_on_hand_kg);
                      const batchCost =
                        toNumber(batch.cost_birds) +
                        toNumber(batch.cost_transport) +
                        toNumber(batch.cost_initial_meds);
                      const totalSpend = kpi?.total_spend ?? batchCost;

                      return (
                        <article className="jpp-batch-card" key={batch.id || batch.batch_code}>
                          <div className="jpp-batch-card-top">
                            <div className="jpp-batch-card-heading">
                              <h4>{displayName}</h4>
                              {displayCode ? (
                                <span className="jpp-batch-card-code">{displayCode}</span>
                              ) : null}
                            </div>
                            <div className="jpp-batch-card-status">
                              <span className={`jpp-batch-status-pill is-${status}`}>
                                {status === "closed" ? "Closed" : "Active"}
                              </span>
                              <button
                                type="button"
                                className="jpp-batch-more-btn"
                                aria-label="Batch options"
                              >
                                <Icon name="more-horizontal" size={18} />
                              </button>
                            </div>
                          </div>
                          <div className="jpp-batch-card-subrow">
                            <span>{birdType || "Bird type N/A"}</span>
                            <span>Started {formatDate(batch.start_date)}</span>
                          </div>
                          <div className="jpp-batch-card-chips">
                            <span className="jpp-batch-chip tone-emerald">
                              <Icon name="feather" size={14} />
                              {formatNumber(aliveCount)} Alive
                            </span>
                            <span className="jpp-batch-chip tone-amber">
                              <Icon name="receipt" size={14} />
                              {formatKg(feedUsed)} Feed used
                            </span>
                            <span className="jpp-batch-chip tone-slate">
                              <Icon name="coins" size={14} />
                              {formatCurrency(totalSpend)}
                            </span>
                          </div>
                        </article>
                      );
                    })
                    )}
                  </div>
                </div>
                <div className="jpp-batches-table">
                  <div className="jpp-table-wrap">
                    <table className="jpp-table">
                      <thead>
                        <tr>
                          <th>Batch</th>
                          <th>Start Date</th>
                          <th>Bird Type</th>
                          <th>Starting Count</th>
                          <th>Feed on Hand</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batches.map((batch) => (
                          <tr key={batch.id || batch.batch_code}>
                            <td>
                              <div className="jpp-batch-name">
                                <span className="jpp-batch-code">
                                  {batch.batch_code || "N/A"}
                                </span>
                                <span className="jpp-batch-sub">
                                  {batch.batch_name || "Unnamed batch"}
                                </span>
                              </div>
                            </td>
                            <td>{formatDate(batch.start_date)}</td>
                            <td>
                              {batch.bird_type || "N/A"}
                              {batch.breed ? ` - ${batch.breed}` : ""}
                            </td>
                            <td>{formatNumber(batch.starting_count)}</td>
                            <td>{formatKg(batch.feed_on_hand_kg)}</td>
                            <td>
                              <div className="jpp-table-actions">
                                <button
                                  type="button"
                                  className="link-button"
                                  onClick={() => handleBatchEdit(batch)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="link-button jpp-danger"
                                  onClick={() => handleBatchDelete(batch.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === "daily" && (
        <div className="jpp-tab-grid jpp-daily-layout">
          <div className="jpp-daily-mobile-shell" aria-label="Daily log mobile view">
            <div className="jpp-daily-mobile-header">
              <span className="jpp-daily-mobile-date">{formatLongDate(selectedDailyDate)}</span>
            </div>
            <div className="jpp-daily-week-strip" aria-label="Select log day">
              {weekDates.map((day) => (
                <button
                  key={day.dateKey}
                  type="button"
                  className={`jpp-daily-week-day${activeDailyDate === day.dateKey ? " is-active" : ""}`}
                  onClick={() => setSelectedDailyDate(day.dateKey)}
                  aria-pressed={activeDailyDate === day.dateKey}
                >
                  <span className="jpp-daily-week-label">{day.label}</span>
                  <span className="jpp-daily-week-date">{day.day}</span>
                </button>
              ))}
            </div>
            <div className="jpp-daily-reminder">
              <div className="jpp-daily-reminder-copy">
                <h4>Record today's log</h4>
                <p>Track feed, eggs, and spend in minutes.</p>
                <button
                  type="button"
                  className="btn-primary jpp-daily-reminder-btn"
                  onClick={handleDailyMobileCta}
                >
                  {hasBatches ? "Add daily log" : "Add a batch"}
                </button>
              </div>
              <div className="jpp-daily-reminder-icon" aria-hidden="true">
                <Icon name="clock-alert" size={28} />
              </div>
            </div>
            <div className="jpp-daily-list-header">
              <h4>Daily logs</h4>
              {selectedDailyDate && (
                <button
                  type="button"
                  className="link-button jpp-daily-see-all"
                  onClick={() => setSelectedDailyDate("")}
                >
                  See all
                </button>
              )}
            </div>
            {dailyLogsForMobile.length === 0 ? (
              <div className="jpp-daily-empty">
                <Icon name="check-circle" size={32} />
                <h4>{dailyEmptyState.title}</h4>
                <p>{dailyEmptyState.copy}</p>
              </div>
            ) : (
              <div className="jpp-daily-list">
                {dailyLogsForMobile.map((log) => {
                  const aliveLabel = formatOptional(log.alive_count, formatNumber);
                  const feedLabel = formatKg(log.feed_used_kg);
                  const subLabel = `${formatDate(log.log_date)} • Alive ${aliveLabel} • Feed ${feedLabel}`;
                  const spendLabel = toNumber(log.money_spent)
                    ? formatCurrency(log.money_spent)
                    : "No spend";
                  const deathsToday = toNumber(log.deaths_today);
                  const deathsLabel = deathsToday
                    ? `${formatNumber(log.deaths_today)} deaths`
                    : "No deaths";
                  return (
                    <div className="jpp-daily-item" key={log.id}>
                      <div className="jpp-daily-item-row">
                        <div
                          className={`jpp-daily-item-dot${deathsToday ? " is-alert" : ""}`}
                        >
                          <Icon name={deathsToday ? "alert" : "check"} size={14} />
                        </div>
                        <div className="jpp-daily-item-body">
                          <span className="jpp-daily-item-title">
                            {getBatchLabel(log.batch_id)}
                          </span>
                          <span className="jpp-daily-item-sub">{subLabel}</span>
                        </div>
                        <div className="jpp-daily-item-meta">
                          <span className="jpp-daily-item-value">{spendLabel}</span>
                          <span
                            className={`jpp-daily-item-meta-line${
                              deathsToday ? " is-alert" : ""
                            }`}
                          >
                            {deathsLabel}
                          </span>
                        </div>
                      </div>
                      <div className="jpp-daily-item-actions">
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => handleDailyEdit(log)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="link-button jpp-danger"
                          onClick={() => handleDailyDelete(log.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              className="jpp-daily-fab"
              onClick={handleDailyMobileCta}
              aria-label={hasBatches ? "Add daily log" : "Add a batch"}
            >
              <Icon name="plus" size={20} />
            </button>
          </div>
          {hasBatches ? (
            <div
              className={`admin-card jpp-daily-form-card ${showDailyFormMobile ? "is-open" : ""}`}
              ref={dailyFormRef}
            >
              <div className="section-header jpp-daily-form-header">
                <h3>{editingDailyId ? "Edit Daily Log" : "Add Daily Log"}</h3>
                <button
                  type="button"
                  className="jpp-daily-form-toggle"
                  onClick={showDailyFormMobile ? closeDailyFormMobile : openDailyFormMobile}
                >
                  {showDailyFormMobile ? "Hide form" : "Add log"}
                </button>
              </div>
              <form className="admin-form" onSubmit={handleDailySubmit}>
                <div className="admin-form-grid">
                  <div className="admin-form-field">
                    <label>Batch *</label>
                    <select name="batch_id" value={dailyForm.batch_id} onChange={handleDailyChange}>
                      <option value="">Select batch</option>
                      {batches.map((batch) => (
                        <option key={batch.id} value={String(batch.id)}>
                          {batch.batch_code || batch.batch_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-form-field">
                    <label>Log Date *</label>
                    <input
                      type="date"
                      name="log_date"
                      value={dailyForm.log_date}
                      onChange={handleDailyChange}
                    />
                  </div>
                </div>

                <div className="jpp-checklist">
                  <label>
                    <input
                      type="checkbox"
                      name="water_clean_full_am"
                      checked={dailyForm.water_clean_full_am}
                      onChange={handleDailyChange}
                    />
                    Water clean (AM)
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      name="feed_given_am"
                      checked={dailyForm.feed_given_am}
                      onChange={handleDailyChange}
                    />
                    Feed given (AM)
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      name="feed_given_pm"
                      checked={dailyForm.feed_given_pm}
                      onChange={handleDailyChange}
                    />
                    Feed given (PM)
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      name="droppings_normal"
                      checked={dailyForm.droppings_normal}
                      onChange={handleDailyChange}
                    />
                    Droppings normal
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      name="temp_vent_ok"
                      checked={dailyForm.temp_vent_ok}
                      onChange={handleDailyChange}
                    />
                    Temp / vent ok
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      name="cleaned_drinkers"
                      checked={dailyForm.cleaned_drinkers}
                      onChange={handleDailyChange}
                    />
                    Cleaned drinkers
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      name="cleaned_feeders"
                      checked={dailyForm.cleaned_feeders}
                      onChange={handleDailyChange}
                    />
                    Cleaned feeders
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      name="predator_check_done"
                      checked={dailyForm.predator_check_done}
                      onChange={handleDailyChange}
                    />
                    Predator check done
                  </label>
                </div>

                <div className="admin-form-grid">
                  <div className="admin-form-field">
                    <label>Alive Count</label>
                    <input
                      type="number"
                      min="0"
                      name="alive_count"
                      value={dailyForm.alive_count}
                      onChange={handleDailyChange}
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Deaths Today</label>
                    <input
                      type="number"
                      min="0"
                      name="deaths_today"
                      value={dailyForm.deaths_today}
                      onChange={handleDailyChange}
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Death Cause</label>
                    <select
                      name="death_cause_code"
                      value={dailyForm.death_cause_code}
                      onChange={handleDailyChange}
                    >
                      {deathCauseOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-form-field">
                    <label>Feed Used (kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="feed_used_kg"
                      value={dailyForm.feed_used_kg}
                      onChange={handleDailyChange}
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Water Refills</label>
                    <input
                      type="number"
                      min="0"
                      name="water_refills"
                      value={dailyForm.water_refills}
                      onChange={handleDailyChange}
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Eggs Collected</label>
                    <input
                      type="number"
                      min="0"
                      name="eggs_collected"
                      value={dailyForm.eggs_collected}
                      onChange={handleDailyChange}
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Money Spent</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="money_spent"
                      value={dailyForm.money_spent}
                      onChange={handleDailyChange}
                    />
                  </div>
                  <div className="admin-form-field admin-form-field--full">
                    <label>Notes</label>
                    <textarea
                      name="notes"
                      value={dailyForm.notes}
                      onChange={handleDailyChange}
                      rows={3}
                    />
                  </div>
                </div>

                <div className="admin-form-actions">
                  <button className="btn-primary" type="submit">
                    {editingDailyId ? "Save Changes" : "Add Daily Log"}
                  </button>
                  {editingDailyId && (
                    <button className="btn-secondary" type="button" onClick={handleDailyCancel}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          ) : (
            <div
              className={`admin-card jpp-empty-card jpp-daily-form-card ${
                showDailyFormMobile ? "is-open" : ""
              }`}
            >
              <h3>No batch found</h3>
              <p className="admin-help">Add a batch first so you can record a daily log.</p>
              <button className="btn-primary" type="button" onClick={() => setActiveTab("batches")}>
                Go to Batches
              </button>
            </div>
          )}

          <div className="admin-card jpp-daily-history-card">
            <div className="section-header">
              <h3>
                <Icon name="check-circle" size={18} /> Daily Log History
              </h3>
            </div>
            {dailyLogs.length === 0 ? (
              <div className="empty-state">
                <Icon name="check-circle" size={40} />
                <h3>No daily logs yet</h3>
                <p>Start recording daily activity for each batch.</p>
              </div>
            ) : (
              <div className="jpp-table-wrap">
                <table className="jpp-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Batch</th>
                      <th>Alive</th>
                      <th>Deaths</th>
                      <th>Feed Used</th>
                      <th>Eggs</th>
                      <th>Spend</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{formatDate(log.log_date)}</td>
                        <td>{getBatchLabel(log.batch_id)}</td>
                        <td>{formatOptional(log.alive_count, formatNumber)}</td>
                        <td>{formatNumber(log.deaths_today)}</td>
                        <td>{formatKg(log.feed_used_kg)}</td>
                        <td>{formatNumber(log.eggs_collected)}</td>
                        <td>{formatCurrency(log.money_spent)}</td>
                        <td>
                          <div className="jpp-table-actions">
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => handleDailyEdit(log)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="link-button jpp-danger"
                              onClick={() => handleDailyDelete(log.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "weekly" && (
        <div className="jpp-tab-grid">
          {hasBatches ? (
            <div
              className={`admin-card jpp-weekly-form-card ${showWeeklyFormMobile ? "is-open" : ""}`}
              ref={weeklyFormRef}
            >
              <div className="section-header jpp-weekly-form-header">
                <h3>{editingWeeklyId ? "Edit Weekly Growth" : "Add Weekly Growth"}</h3>
                <button
                  type="button"
                  className="jpp-weekly-form-toggle"
                  onClick={showWeeklyFormMobile ? closeWeeklyFormMobile : openWeeklyFormMobile}
                >
                  {showWeeklyFormMobile ? "Hide form" : "Add weekly"}
                </button>
              </div>
              <form className="admin-form" onSubmit={handleWeeklySubmit}>
                <div className="admin-form-grid">
                  <div className="admin-form-field">
                    <label>Batch *</label>
                    <select name="batch_id" value={weeklyForm.batch_id} onChange={handleWeeklyChange}>
                      <option value="">Select batch</option>
                      {batches.map((batch) => (
                        <option key={batch.id} value={String(batch.id)}>
                          {batch.batch_code || batch.batch_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-form-field">
                    <label>Week Ending *</label>
                    <input
                      type="date"
                      name="week_ending"
                      value={weeklyForm.week_ending}
                      onChange={handleWeeklyChange}
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Sample Size</label>
                    <input
                      type="number"
                      min="0"
                      name="sample_size"
                      value={weeklyForm.sample_size}
                      onChange={handleWeeklyChange}
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Avg Weight (kg)</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      name="avg_weight_kg"
                      value={weeklyForm.avg_weight_kg}
                      onChange={handleWeeklyChange}
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Min Weight (kg)</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      name="min_weight_kg"
                      value={weeklyForm.min_weight_kg}
                      onChange={handleWeeklyChange}
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Max Weight (kg)</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      name="max_weight_kg"
                      value={weeklyForm.max_weight_kg}
                      onChange={handleWeeklyChange}
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Body Score Avg</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="body_score_avg"
                      value={weeklyForm.body_score_avg}
                      onChange={handleWeeklyChange}
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Feed Used (kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="feed_used_week_kg"
                      value={weeklyForm.feed_used_week_kg}
                      onChange={handleWeeklyChange}
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Meds Given</label>
                    <input
                      name="meds_given"
                      value={weeklyForm.meds_given}
                      onChange={handleWeeklyChange}
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Birds Sold</label>
                    <input
                      type="number"
                      min="0"
                      name="birds_sold"
                      value={weeklyForm.birds_sold}
                      onChange={handleWeeklyChange}
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Birds Culled</label>
                    <input
                      type="number"
                      min="0"
                      name="birds_culled"
                      value={weeklyForm.birds_culled}
                      onChange={handleWeeklyChange}
                    />
                  </div>
                  <div className="admin-form-field admin-form-field--full">
                    <label>Notes</label>
                    <textarea
                      name="notes"
                      value={weeklyForm.notes}
                      onChange={handleWeeklyChange}
                      rows={3}
                    />
                  </div>
                </div>

                <div className="admin-form-actions">
                  <button className="btn-primary" type="submit">
                    {editingWeeklyId ? "Save Changes" : "Add Weekly Growth"}
                  </button>
                  {editingWeeklyId && (
                    <button className="btn-secondary" type="button" onClick={handleWeeklyCancel}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          ) : (
            <div className="admin-card jpp-empty-card">
              <h3>No batch found</h3>
              <p className="admin-help">Add a batch first so you can record weekly growth.</p>
              <button className="btn-primary" type="button" onClick={() => setActiveTab("batches")}>
                Go to Batches
              </button>
            </div>
          )}

          <div className="admin-card">
            <div className="section-header jpp-weekly-list-header">
              <h3>
                <Icon name="calendar" size={18} /> Weekly Growth History
              </h3>
              {hasBatches && (
                <button type="button" className="jpp-weekly-add-btn" onClick={openWeeklyFormMobile}>
                  <Icon name="plus" size={16} />
                  Add weekly
                </button>
              )}
            </div>
            {weeklyGrowth.length === 0 ? (
              <div className="empty-state">
                <Icon name="calendar" size={40} />
                <h3>No weekly growth entries yet</h3>
                <p>Capture weekly growth stats for each batch.</p>
              </div>
            ) : (
              <>
                <div className="jpp-weekly-mobile-list">
                  {weeklyGrowth.map((entry) => {
                    const sampleLabel = formatOptional(entry.sample_size, formatNumber);
                    const scoreLabel = formatOptional(entry.body_score_avg, formatNumber);
                    const chipLabel =
                      sampleLabel !== "-"
                        ? `Sample ${sampleLabel}`
                        : scoreLabel !== "-"
                        ? `Score ${scoreLabel}`
                        : "Weekly log";
                    return (
                      <article className="jpp-weekly-card" key={entry.id}>
                        <div className="jpp-weekly-card-header">
                          <div>
                            <span className="jpp-weekly-card-title">
                              {getBatchLabel(entry.batch_id)}
                            </span>
                            <span className="jpp-weekly-card-date">
                              Week ending {formatDate(entry.week_ending)}
                            </span>
                          </div>
                          <span className="jpp-weekly-card-chip">
                            <Icon name="calendar" size={12} />
                            {chipLabel}
                          </span>
                        </div>
                      <div className="jpp-weekly-metric-grid">
                        <div className="jpp-weekly-metric">
                          <span className="jpp-weekly-metric-label">Avg Weight</span>
                          <span className="jpp-weekly-metric-value">
                            {formatOptional(entry.avg_weight_kg, formatKg)}
                          </span>
                        </div>
                        <div className="jpp-weekly-metric">
                          <span className="jpp-weekly-metric-label">Min / Max</span>
                          <span className="jpp-weekly-metric-value">
                            {formatOptional(entry.min_weight_kg, formatKg)} /{" "}
                            {formatOptional(entry.max_weight_kg, formatKg)}
                          </span>
                        </div>
                        <div className="jpp-weekly-metric">
                          <span className="jpp-weekly-metric-label">Feed Used</span>
                          <span className="jpp-weekly-metric-value">
                            {formatKg(entry.feed_used_week_kg)}
                          </span>
                        </div>
                        <div className="jpp-weekly-metric">
                          <span className="jpp-weekly-metric-label">Birds Sold</span>
                          <span className="jpp-weekly-metric-value">
                            {formatNumber(entry.birds_sold)}
                          </span>
                        </div>
                      </div>
                      <div className="jpp-weekly-card-actions">
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => handleWeeklyEdit(entry)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="link-button jpp-danger"
                          onClick={() => handleWeeklyDelete(entry.id)}
                        >
                          Delete
                        </button>
                      </div>
                      </article>
                    );
                  })}
                </div>
                <div className="jpp-weekly-table">
                  <div className="jpp-table-wrap">
                    <table className="jpp-table">
                      <thead>
                        <tr>
                          <th>Week Ending</th>
                          <th>Batch</th>
                          <th>Avg Wt</th>
                          <th>Min / Max</th>
                          <th>Score</th>
                          <th>Feed</th>
                          <th>Sold</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weeklyGrowth.map((entry) => (
                          <tr key={entry.id}>
                            <td>{formatDate(entry.week_ending)}</td>
                            <td>{getBatchLabel(entry.batch_id)}</td>
                            <td>{formatOptional(entry.avg_weight_kg, formatKg)}</td>
                            <td>
                              {formatOptional(entry.min_weight_kg, formatKg)} /{" "}
                              {formatOptional(entry.max_weight_kg, formatKg)}
                            </td>
                            <td>{formatOptional(entry.body_score_avg, formatNumber)}</td>
                            <td>{formatKg(entry.feed_used_week_kg)}</td>
                            <td>{formatNumber(entry.birds_sold)}</td>
                            <td>
                              <div className="jpp-table-actions">
                                <button
                                  type="button"
                                  className="link-button"
                                  onClick={() => handleWeeklyEdit(entry)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="link-button jpp-danger"
                                  onClick={() => handleWeeklyDelete(entry.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === "birds" && (
        <div className="jpp-tab-grid">
          <div
            className={`admin-card jpp-bird-form-card ${showBirdFormMobile ? "is-open" : ""}`}
            ref={birdFormRef}
          >
            <div className="section-header jpp-bird-form-header">
              <h3>
                <Icon name="users" size={18} /> Temp Bird Intake
              </h3>
              <button
                type="button"
                className="jpp-bird-form-toggle"
                onClick={showBirdFormMobile ? closeBirdFormMobile : openBirdFormMobile}
              >
                {showBirdFormMobile ? "Hide form" : "Add bird"}
              </button>
            </div>
            <p className="admin-help">
              Uploads go to the `birds` bucket. Add one bird at a time for now.
            </p>
            {birdProducts.length === 0 ? (
              <div className="empty-state">
                <Icon name="folder" size={40} />
                <h3>No bird products yet</h3>
                <p>Create a JPP product with tracking mode "individual" to start adding birds.</p>
              </div>
            ) : (
              <form className="admin-form" onSubmit={handleBirdSubmit}>
                <div className="admin-form-grid">
                  <div className="admin-form-field">
                    <label>Product *</label>
                    <select
                      name="product_id"
                      value={birdForm.product_id}
                      onChange={handleBirdChange}
                      required
                    >
                      <option value="">Select product</option>
                      {birdProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                          {product.category ? ` (${product.category})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-form-field">
                    <label>Batch (Optional)</label>
                    <select name="batch_id" value={birdForm.batch_id} onChange={handleBirdChange}>
                      <option value="">Unassigned</option>
                      {batches.map((batch) => (
                        <option key={batch.id} value={String(batch.id)}>
                          {batch.batch_code || batch.batch_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-form-field">
                    <label>Tag ID</label>
                    <input
                      name="tag_id"
                      value={birdForm.tag_id}
                      onChange={handleBirdChange}
                      placeholder="JPP-001"
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Bird Name</label>
                    <input
                      name="bird_name"
                      value={birdForm.bird_name}
                      onChange={handleBirdChange}
                      placeholder="Layer 1"
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Sex</label>
                    <select name="sex" value={birdForm.sex} onChange={handleBirdChange}>
                      {birdSexOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-form-field">
                    <label>Breed Label</label>
                    <input
                      name="breed_label"
                      value={birdForm.breed_label}
                      onChange={handleBirdChange}
                      placeholder="Kienyeji"
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Age Stage</label>
                    <select
                      name="age_stage"
                      value={birdForm.age_stage}
                      onChange={handleBirdChange}
                    >
                      {birdAgeStageOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-form-field">
                    <label>Color</label>
                    <input
                      name="color_label"
                      value={birdForm.color_label}
                      onChange={handleBirdChange}
                      placeholder="Brown"
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Pattern</label>
                    <input
                      name="pattern_label"
                      value={birdForm.pattern_label}
                      onChange={handleBirdChange}
                      placeholder="Speckled"
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Hatch Date</label>
                    <input
                      type="date"
                      name="hatch_date"
                      value={birdForm.hatch_date}
                      onChange={handleBirdChange}
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Acquired Date *</label>
                    <input
                      type="date"
                      name="acquired_date"
                      value={birdForm.acquired_date}
                      onChange={handleBirdChange}
                      required
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Source</label>
                    <select
                      name="acquired_source"
                      value={birdForm.acquired_source}
                      onChange={handleBirdChange}
                    >
                      {birdSourceOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-form-field">
                    <label>Status</label>
                    <select name="status" value={birdForm.status} onChange={handleBirdChange}>
                      {birdStatusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-form-field">
                    <label>Status Date</label>
                    <input
                      type="date"
                      name="status_date"
                      value={birdForm.status_date}
                      onChange={handleBirdChange}
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Photo</label>
                    <input
                      key={birdPhotoKey}
                      type="file"
                      accept="image/*"
                      onChange={handleBirdPhotoChange}
                    />
                  </div>
                  {birdPhotoPreview && (
                    <div className="admin-form-field admin-form-field--full">
                      <label>Photo Preview</label>
                      <img
                        src={birdPhotoPreview}
                        alt="Bird preview"
                        style={{
                          maxWidth: "220px",
                          borderRadius: "12px",
                          border: "1px solid #e5e7eb",
                        }}
                      />
                    </div>
                  )}
                  <div className="admin-form-field admin-form-field--full">
                    <label>Description</label>
                    <textarea
                      name="description"
                      value={birdForm.description}
                      onChange={handleBirdChange}
                      rows={3}
                    />
                  </div>
                  <div className="admin-form-field admin-form-field--full">
                    <label>Notes</label>
                    <textarea
                      name="notes"
                      value={birdForm.notes}
                      onChange={handleBirdChange}
                      rows={3}
                    />
                  </div>
                </div>
                <div className="admin-form-actions">
                  <button className="btn-primary" type="submit" disabled={savingBird}>
                    {savingBird ? "Saving..." : "Add Bird"}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="admin-card">
            <div className="section-header">
              <h3>
                <Icon name="folder" size={18} /> Birds
              </h3>
            </div>
            {birds.length === 0 ? (
              <div className="empty-state">
                <Icon name="folder" size={40} />
                <h3>No birds recorded yet</h3>
                <p>Add the first bird to start tracking.</p>
              </div>
            ) : (
              <>
                <div className="jpp-birds-mobile">
                  <div className="jpp-birds-mobile-swiper">
                    {birds.map((bird) => {
                      const displayTag = bird.tag_id || String(bird.id || "").slice(0, 8);
                      const birdTitle = bird.bird_name || displayTag;
                      const productLabel = getBirdProductLabel(bird.product_id);
                      const batchLabel = getBatchLabel(bird.batch_id);
                      const ageStageLabel =
                        bird.age_stage && bird.age_stage !== "unknown" ? bird.age_stage : null;
                      const colorPattern = [bird.color_label, bird.pattern_label]
                        .filter(Boolean)
                        .join(" / ");
                      const categoryPrimary = ageStageLabel || bird.breed_label || "General";
                      const categorySecondary = colorPattern || bird.acquired_source || "Standard";
                      const heroTitle = bird.tag_id || birdTitle;
                      const heroMeta = [bird.breed_label, bird.pattern_label, ageStageLabel]
                        .filter(Boolean)
                        .map(formatLabel)
                        .join(" • ");
                      const healthStatus = getHealthStatus(bird);
                      const statusLabel = formatLabel(bird.status || "unknown");
                      const sexLabel = formatLabel(bird.sex || "unknown");
                      const lastChecked =
                        bird.last_log_date || bird.status_date || bird.acquired_date || "";
                      const ageDays = getAgeDays(bird.hatch_date || bird.acquired_date);
                      const ageLabel =
                        ageDays === null ? "Age N/A" : `~${ageDays} day${ageDays === 1 ? "" : "s"} old`;
                      const issuesLabel =
                        bird.status && bird.status !== "alive"
                          ? formatLabel(bird.status)
                          : "None";
                      const mortalityRisk = getMortalityRisk(bird);
                      const detailItems = [
                        { label: "Tag", value: displayTag, icon: "tag", tone: "teal" },
                        {
                          label: "Breed",
                          value: bird.breed_label || "Unknown",
                          icon: "feather",
                          tone: "mint",
                        },
                        {
                          label: "Source",
                          value: bird.acquired_source || "Unknown",
                          icon: "truck",
                          tone: "amber",
                        },
                        {
                          label: "Acquired",
                          value: formatDate(bird.acquired_date),
                          icon: "calendar",
                          tone: "sky",
                        },
                      ];
                      const lastWeekLabel = bird.last_week_ending
                        ? formatDate(bird.last_week_ending)
                        : "No weekly log";
                      const weeklyMetrics = [
                        {
                          label: "Birds counted",
                          value: formatOptional(bird.weekly_bird_count, formatNumber),
                        },
                        {
                          label: "Feed",
                          value: formatOptional(bird.feed_per_bird_week_kg, formatKg),
                        },
                        {
                          label: "Sold share",
                          value: formatOptional(bird.birds_sold_per_bird, formatNumber),
                        },
                        {
                          label: "Culled share",
                          value: formatOptional(bird.birds_culled_per_bird, formatNumber),
                        },
                      ];
                      const bio =
                        bird.description?.trim() ||
                        bird.notes?.trim() ||
                        "JPP bird profile for tracking health, growth, and status updates.";

                      return (
                        <article className="jpp-bird-card" key={bird.id}>
                          <div className="jpp-bird-hero">
                            {bird.photo_url ? (
                              <img
                                src={bird.photo_url}
                                alt={`Bird ${displayTag}`}
                                loading="lazy"
                              />
                            ) : (
                              <div className="jpp-bird-hero-placeholder">
                                <span>No photo</span>
                              </div>
                            )}
                            <div className="jpp-bird-hero-badges">
                              <span className={`jpp-bird-chip status-${bird.status || "unknown"}`}>
                                {statusLabel}
                              </span>
                              <span className="jpp-bird-chip chip-light">
                                {sexLabel}
                              </span>
                              <span className={`jpp-bird-chip chip-health tone-${healthStatus.tone}`}>
                                {healthStatus.label}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="jpp-bird-hero-action"
                              onClick={showBirdFormMobile ? closeBirdFormMobile : openBirdFormMobile}
                              aria-label="Add bird"
                            >
                              <Icon name="plus" size={16} />
                            </button>
                            <div className="jpp-bird-hero-caption">
                              <span className="jpp-bird-hero-title">{heroTitle}</span>
                              <span className="jpp-bird-hero-sub">
                                {heroMeta || formatLabel(productLabel)}
                              </span>
                            </div>
                          </div>
                          <div className="jpp-bird-card-body">
                            <div className="jpp-bird-profile-mobile">
                              <div className={`jpp-bird-health-card tone-${healthStatus.tone}`}>
                                <div className="jpp-bird-health-icon">
                                  <Icon name="check-circle" size={18} />
                                </div>
                                <div>
                                  <span className="jpp-bird-health-title">{healthStatus.label}</span>
                                  <span className="jpp-bird-health-sub">
                                    Last checked {lastChecked ? formatDate(lastChecked) : "N/A"}
                                  </span>
                                </div>
                              </div>
                              <div className="jpp-bird-quick-grid">
                                <div className="jpp-bird-quick-item">
                                  <span className="jpp-bird-quick-icon tone-amber">
                                    <Icon name="calendar" size={14} />
                                  </span>
                                  <div>
                                    <span className="jpp-bird-quick-value">{ageLabel}</span>
                                    <span className="jpp-bird-quick-label">Age</span>
                                  </div>
                                </div>
                                <div className="jpp-bird-quick-item">
                                  <span className="jpp-bird-quick-icon tone-green">
                                    <Icon name="feather" size={14} />
                                  </span>
                                  <div>
                                    <span className="jpp-bird-quick-value">
                                      {formatLabel(productLabel)}
                                    </span>
                                    <span className="jpp-bird-quick-label">Category</span>
                                  </div>
                                </div>
                              </div>
                              <div className="jpp-bird-panel-grid">
                                <div className="jpp-bird-panel">
                                  <h5>Key attributes</h5>
                                  <div className="jpp-bird-panel-list">
                                    <div className="jpp-bird-panel-row">
                                      <span>Age stage</span>
                                      <strong>{formatLabel(ageStageLabel)}</strong>
                                    </div>
                                    <div className="jpp-bird-panel-row">
                                      <span>Breed</span>
                                      <strong>{formatLabel(bird.breed_label)}</strong>
                                    </div>
                                    <div className="jpp-bird-panel-row">
                                      <span>Tag ID</span>
                                      <strong>{displayTag}</strong>
                                    </div>
                                    <div className="jpp-bird-panel-row">
                                      <span>Batch</span>
                                      <strong>{batchLabel}</strong>
                                    </div>
                                    <div className="jpp-bird-panel-row">
                                      <span>Acquired</span>
                                      <strong>{formatDate(bird.acquired_date)}</strong>
                                    </div>
                                  </div>
                                </div>
                                <div className="jpp-bird-panel">
                                  <h5>Last 7 days</h5>
                                  <div className="jpp-bird-panel-list">
                                    <div className="jpp-bird-panel-row">
                                      <span>Feed</span>
                                      <strong>
                                        {formatOptional(bird.feed_per_bird_week_kg, formatKg)}
                                      </strong>
                                    </div>
                                    <div className="jpp-bird-panel-row">
                                      <span>Eggs</span>
                                      <strong>{formatOptional(bird.eggs_per_bird, formatNumber)}</strong>
                                    </div>
                                    <div className="jpp-bird-panel-row">
                                      <span>Issues</span>
                                      <strong>{issuesLabel}</strong>
                                    </div>
                                    <div className="jpp-bird-panel-row">
                                      <span>Mortality risk</span>
                                      <span className={`jpp-bird-risk-badge tone-${mortalityRisk.tone}`}>
                                        {mortalityRisk.label}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="jpp-bird-action-bar">
                                <button type="button" className="jpp-bird-action-icon">
                                  <Icon name="heart" size={16} />
                                  Vaccination
                                </button>
                                <button type="button" className="jpp-bird-action-icon">
                                  <Icon name="truck" size={16} />
                                  Transfer
                                </button>
                              </div>
                            </div>
                            <div className="jpp-bird-header">
                              <h4>{birdTitle}</h4>
                              <p className="jpp-bird-meta">
                                <span>{productLabel}</span>
                              </p>
                            </div>
                            <p className="jpp-bird-bio">{bio}</p>
                            <div className="jpp-bird-feature-grid">
                              <div className="jpp-bird-feature">
                                <span className="jpp-bird-feature-icon" aria-hidden="true"></span>
                                <div>
                                  <span className="jpp-bird-feature-title">{categoryPrimary}</span>
                                  <span className="jpp-bird-feature-sub">Age Stage</span>
                                </div>
                              </div>
                              <div className="jpp-bird-feature">
                                <span className="jpp-bird-feature-icon" aria-hidden="true"></span>
                                <div>
                                  <span className="jpp-bird-feature-title">{categorySecondary}</span>
                                  <span className="jpp-bird-feature-sub">Color / Pattern</span>
                                </div>
                              </div>
                            </div>
                            <div className="jpp-bird-info-grid">
                              {detailItems.map((item) => (
                                <div className="jpp-bird-info-item" key={item.label}>
                                  <span className={`jpp-bird-info-icon tone-${item.tone}`}>
                                    <Icon name={item.icon} size={16} />
                                  </span>
                                  <div className="jpp-bird-info-text">
                                    <span className="jpp-bird-info-label">{item.label}</span>
                                    <span className="jpp-bird-info-value">{item.value}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="jpp-bird-metrics">
                              <div className="jpp-bird-metric-block">
                                <span className="jpp-bird-metric-title">
                                  Latest Weekly • {lastWeekLabel}
                                </span>
                                <div className="jpp-bird-metric-grid">
                                  {weeklyMetrics.map((metric) => (
                                    <div className="jpp-bird-metric-item" key={metric.label}>
                                      <span className="jpp-bird-metric-label">{metric.label}</span>
                                      <span className="jpp-bird-metric-value">{metric.value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="jpp-bird-action-grid">
                              <button
                                type="button"
                                className="jpp-bird-action"
                                onClick={openBirdFormMobile}
                              >
                                <Icon name="plus" size={16} />
                                Add Bird
                              </button>
                              <button type="button" className="jpp-bird-action is-disabled" disabled>
                                <Icon name="check-circle" size={16} />
                                Health Tips
                              </button>
                              <button type="button" className="jpp-bird-action is-disabled" disabled>
                                <Icon name="receipt" size={16} />
                                Vaccination
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
                <div className="jpp-birds-table">
                  <div className="jpp-birds-table-header">
                    <span className="jpp-birds-count">
                      1 - {Math.min(24, birds.length)} of {birds.length} birds
                    </span>
                    <div className="jpp-birds-view">
                      <button type="button" className="jpp-birds-view-btn is-active">
                        <Icon name="menu" size={16} />
                      </button>
                      <button type="button" className="jpp-birds-view-btn">
                        <Icon name="folder" size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="jpp-table-wrap">
                    <table className="jpp-table jpp-bird-table">
                      <thead>
                        <tr>
                          <th>Bird</th>
                          <th>Batch</th>
                          <th>Status</th>
                          <th>Acquired</th>
                          <th>Status Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {birds.map((bird) => {
                          const displayTag = bird.tag_id || String(bird.id || "").slice(0, 8);
                          const birdTitle = bird.bird_name || displayTag;
                          const productLabel = getBirdProductLabel(bird.product_id);
                          const colorPattern = [bird.color_label, bird.pattern_label]
                            .filter(Boolean)
                            .join(" / ");
                          const rowChips = [
                            bird.age_stage && bird.age_stage !== "unknown" ? bird.age_stage : null,
                            bird.sex && bird.sex !== "unknown" ? bird.sex : null,
                            bird.breed_label || null,
                            colorPattern || null,
                          ].filter(Boolean);
                          return (
                            <tr key={bird.id}>
                              <td>
                                <div className="jpp-bird-row">
                                  <div className="jpp-bird-row-thumb">
                                    {bird.photo_url ? (
                                      <img src={bird.photo_url} alt={displayTag} loading="lazy" />
                                    ) : (
                                      <div className="jpp-bird-row-thumb-placeholder">
                                        <Icon name="users" size={14} />
                                      </div>
                                    )}
                                  </div>
                                  <div className="jpp-bird-row-info">
                                    <span className="jpp-bird-row-title">{birdTitle}</span>
                                    <span className="jpp-bird-row-sub">
                                      {productLabel} • {displayTag}
                                    </span>
                                    <div className="jpp-bird-row-chips">
                                      {rowChips.map((chip, index) => (
                                        <span
                                          className="jpp-bird-row-chip"
                                          key={`${chip}-${index}`}
                                        >
                                          {chip}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td>{getBatchLabel(bird.batch_id)}</td>
                              <td>
                                <span className={`jpp-bird-status status-${bird.status || "unknown"}`}>
                                  {bird.status || "unknown"}
                                </span>
                              </td>
                              <td>{formatDate(bird.acquired_date)}</td>
                              <td>{formatDate(bird.status_date)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
