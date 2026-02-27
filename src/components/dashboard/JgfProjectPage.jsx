import { useEffect, useMemo, useState } from "react";
import { Icon } from "../icons.jsx";
import {
  createJgfBatch,
  createJgfExpense,
  createJgfProductionLog,
  createJgfPurchase,
  createJgfSale,
  deleteJgfBatch,
  deleteJgfExpense,
  deleteJgfProductionLog,
  deleteJgfPurchase,
  deleteJgfSale,
  getJgfBatches,
  getJgfBatchKpis,
  getJgfExpenses,
  getJgfInventory,
  getJgfProductionLogs,
  getJgfPurchases,
  getJgfSales,
  updateJgfBatch,
  updateJgfExpense,
  updateJgfInventory,
  updateJgfProductionLog,
  updateJgfPurchase,
  updateJgfSale,
  getJgfLandLeases,
  getJgfCropCycles,
  getJgfFarmingLogs,
  createJgfLandLease,
  updateJgfLandLease,
  deleteJgfLandLease,
  createJgfCropCycle,
  updateJgfCropCycle,
  deleteJgfCropCycle,
  createJgfFarmingLog,
  updateJgfFarmingLog,
  deleteJgfFarmingLog,
  getProjectsWithMembership,
} from "../../lib/dataService.js";

const parseNumberOrZero = (val) => {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

const parseOptionalInteger = (val) => {
  if (val === "" || val === null || val === undefined) return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES'
  }).format(amount || 0);
};

const productTypes = [
  { value: "peanut_butter", label: "Peanut Butter" },
  { value: "roasted_nuts", label: "Roasted Nuts" },
  { value: "groundnut_flour", label: "Groundnut Flour" },
  { value: "gizzards", label: "Fried Gizzards" },
  { value: "other", label: "Other" },
];

const expenseCategories = [
  "Raw Materials",
  "Packaging",
  "Labour",
  "Equipment",
  "Transport",
  "Utilities",
  "Marketing",
  "Other",
];

const customerTypes = [
  { value: "retail", label: "Retail Item" },
  { value: "wholesale", label: "Wholesale Order" },
  { value: "distributor", label: "Distributor" },
  { value: "institution", label: "Institution" },
];

const paymentMethods = [
  { value: "cash", label: "Cash" },
  { value: "mpesa", label: "M-Pesa" },
  { value: "bank", label: "Bank Transfer" },
  { value: "credit", label: "Credit/Pending" },
];

const itemTypes = [
  { value: "raw_material", label: "Raw Material" },
  { value: "packaging", label: "Packaging" },
  { value: "product", label: "Finished Product" },
];

const downloadDocs = [
  { key: "production", label: "Production Log Sheet" },
  { key: "sales", label: "Sales Record Sheet" },
  { key: "inventory", label: "Inventory Checklist" },
];

function JgfProjectPage({ user, tenantRole, tenantId, activeProjectId, onProjectChange }) {
  const today = new Date().toISOString().slice(0, 10);
  const effectiveRole = String(tenantRole || user?.role || "member").toLowerCase();
  const canManage = ["admin", "superadmin", "project_manager"].includes(effectiveRole);
  const canViewAllProjects = ["admin", "superadmin"].includes(effectiveRole);

  const initialBatchForm = {
    batch_code: "",
    batch_name: "",
    product_type: "peanut_butter",
    start_date: today,
    raw_groundnuts_kg: "",
    output_quantity_kg: "",
    output_units: "",
    unit_size_grams: "500",
    selling_price_per_unit: "",
    status: "in_progress",
    notes: "",
  };

  const initialProductionForm = {
    batch_id: "",
    log_date: today,
    groundnuts_processed_kg: "",
    output_produced_kg: "",
    units_packaged: "",
    quality_grade: "premium",
    wastage_kg: "",
    workers_count: "",
    hours_worked: "",
    equipment_used: "",
    issues_notes: "",
  };

  const initialSalesForm = {
    batch_id: "",
    sale_date: today,
    product_type: "peanut_butter",
    quantity_units: "",
    unit_price: "",
    total_amount: "",
    customer_name: "",
    customer_type: "retail",
    payment_status: "paid",
    payment_method: "cash",
    notes: "",
  };

  const initialExpenseForm = {
    batch_id: "",
    expense_date: today,
    category: "Raw Materials",
    amount: "",
    vendor: "",
    description: "",
    receipt_available: false,
  };

  const initialPurchaseForm = {
    purchase_date: today,
    supplier_name: "",
    item_type: "groundnuts",
    quantity: "",
    unit: "kg",
    unit_price: "",
    total_amount: "",
    quality_grade: "",
    payment_status: "paid",
    notes: "",
  };

  const initialLandLeaseForm = {
    name: "",
    location: "",
    size_acres: "",
    lease_cost: "",
    start_date: today,
    end_date: "",
    landowner_name: "",
    landowner_contact: "",
    status: "active",
    notes: "",
  };

  const initialCropCycleForm = {
    lease_id: "",
    cycle_name: "",
    crop_variety: "Groundnuts",
    start_date: today,
    end_date: "",
    status: "planned",
    projected_yield_kg: "",
    actual_yield_kg: "",
    notes: "",
  };

  const initialFarmingLogForm = {
    cycle_id: "",
    activity_date: today,
    activity_type: "scouting",
    description: "",
    labour_cost: "",
    input_cost: "",
    equipment_cost: "",
    other_cost: "",
    notes: "",
  };

  const [activeTab, setActiveTab] = useState("overview");
  const [batches, setBatches] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [productionLogs, setProductionLogs] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [landLeases, setLandLeases] = useState([]);
  const [cropCycles, setCropCycles] = useState([]);
  const [farmingLogs, setFarmingLogs] = useState([]);
  
  const [moduleCounts, setModuleCounts] = useState({
    productionLogs: 0,
    sales: 0,
    expenses: 0,
    inventory: 0,
    purchases: 0,
    landLeases: 0,
    cropCycles: 0,
    farmingLogs: 0,
  });
  
  const [loading, setLoading] = useState(true);

  const [batchForm, setBatchForm] = useState(initialBatchForm);
  const [productionForm, setProductionForm] = useState(initialProductionForm);
  const [salesForm, setSalesForm] = useState(initialSalesForm);
  const [expenseForm, setExpenseForm] = useState(initialExpenseForm);
  const [purchaseForm, setPurchaseForm] = useState(initialPurchaseForm);
  const [landLeaseForm, setLandLeaseForm] = useState(initialLandLeaseForm);
  const [cropCycleForm, setCropCycleForm] = useState(initialCropCycleForm);
  const [farmingLogForm, setFarmingLogForm] = useState(initialFarmingLogForm);

  const [editingBatchId, setEditingBatchId] = useState(null);
  const [editingProductionId, setEditingProductionId] = useState(null);
  const [editingSalesId, setEditingSalesId] = useState(null);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [editingPurchaseId, setEditingPurchaseId] = useState(null);
  const [editingLandLeaseId, setEditingLandLeaseId] = useState(null);
  const [editingCropCycleId, setEditingCropCycleId] = useState(null);
  const [editingFarmingLogId, setEditingFarmingLogId] = useState(null);
  
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [printSheet, setPrintSheet] = useState("");
  const [selectedDownloadDoc, setSelectedDownloadDoc] = useState("");
  const [showDownloadPreview, setShowDownloadPreview] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [showSalesForm, setShowSalesForm] = useState(false);
  const [showCropCycleForm, setShowCropCycleForm] = useState(false);
  const [showFarmingLogForm, setShowFarmingLogForm] = useState(false);
  const [showFarmingMenu, setShowFarmingMenu] = useState(false);
  const [showLandLeaseForm, setShowLandLeaseForm] = useState(false);

  

  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  
  const hasBatches = batches.length > 0;
  const [moduleProjects, setModuleProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectsLoading, setProjectsLoading] = useState(true);

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

  const resolveJgfProject = (project) => {
    const raw = project?.module_key || project?.code || "";
    const lower = String(raw).trim().toLowerCase();
    if (lower === "jgf") return true;
    return String(raw).trim().toUpperCase() === "JGF";
  };

  const handleProjectChange = (event) => {
    const nextId = event.target.value;
    setSelectedProjectId(nextId);
    if (typeof onProjectChange === "function") {
      onProjectChange(nextId ? Number(nextId) : null);
    }
  };

  useEffect(() => {
    const loadProjects = async () => {
      if (!tenantId || !user?.id) {
        setModuleProjects([]);
        setSelectedProjectId("");
        setProjectsLoading(false);
        return;
      }
      setProjectsLoading(true);
      try {
        const data = await getProjectsWithMembership(user?.id, tenantId);
        const moduleList = (data || []).filter(resolveJgfProject);
        const accessible = canViewAllProjects
          ? moduleList
          : moduleList.filter(
              (project) => project.membership || project.project_leader === user?.id
            );
        setModuleProjects(accessible);
      } catch (error) {
        console.error("Error loading JGF projects:", error);
        setModuleProjects([]);
      } finally {
        setProjectsLoading(false);
      }
    };
    loadProjects();
  }, [user?.id, tenantId, canViewAllProjects]);

  useEffect(() => {
    if (projectsLoading) {
      return;
    }
    if (moduleProjects.length === 0) {
      if (selectedProjectId) {
        setSelectedProjectId("");
      }
      if (typeof onProjectChange === "function") {
        onProjectChange(null);
      }
      return;
    }
    const activeId = activeProjectId ? String(activeProjectId) : "";
    const activeValid = activeId && moduleProjects.some((p) => String(p.id) === activeId);
    const currentValid =
      selectedProjectId && moduleProjects.some((p) => String(p.id) === selectedProjectId);
    const nextId = activeValid
      ? activeId
      : currentValid
        ? selectedProjectId
        : String(moduleProjects[0].id);
    if (nextId !== selectedProjectId) {
      setSelectedProjectId(nextId);
    }
    if (typeof onProjectChange === "function") {
      onProjectChange(nextId ? Number(nextId) : null);
    }
  }, [moduleProjects, activeProjectId, projectsLoading]);

  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return moduleProjects.find((project) => String(project.id) === selectedProjectId) || null;
  }, [moduleProjects, selectedProjectId]);

  const loadJgfData = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      resetMessages();
      if (!selectedProjectId) {
        setBatches([]);
        setKpis([]);
        setProductionLogs([]);
        setSales([]);
        setExpenses([]);
        setInventory([]);
        setPurchases([]);
        setLandLeases([]);
        setCropCycles([]);
        setFarmingLogs([]);
        setModuleCounts({
          productionLogs: 0,
          sales: 0,
          expenses: 0,
          inventory: 0,
          purchases: 0,
          landLeases: 0,
          cropCycles: 0,
          farmingLogs: 0,
        });
        return;
      }
      const results = await Promise.allSettled([
        getJgfBatches(tenantId, selectedProjectId),
        getJgfBatchKpis(tenantId, selectedProjectId),
        getJgfProductionLogs(tenantId, selectedProjectId),
        getJgfSales(tenantId, selectedProjectId),
        getJgfExpenses(tenantId, selectedProjectId),
        getJgfInventory(tenantId, selectedProjectId),
        getJgfPurchases(tenantId, selectedProjectId),
        getJgfLandLeases(tenantId, selectedProjectId),
        getJgfCropCycles(tenantId, selectedProjectId),
        getJgfFarmingLogs(undefined, tenantId, selectedProjectId),
      ]);

      const [
        batchRes,
        kpiRes,
        prodRes,
        salesRes,
        expenseRes,
        invRes,
        purchRes,
        landRes,
        cycleRes,
        logRes,
      ] = results;

      const safeBatches = batchRes.status === "fulfilled" ? batchRes.value || [] : [];
      const safeKpis = kpiRes.status === "fulfilled" ? kpiRes.value || [] : [];
      const safeProd = prodRes.status === "fulfilled" ? prodRes.value || [] : [];
      const safeSales = salesRes.status === "fulfilled" ? salesRes.value || [] : [];
      const safeExpenses = expenseRes.status === "fulfilled" ? expenseRes.value || [] : [];
      const safeInventory = invRes.status === "fulfilled" ? invRes.value || [] : [];
      const safePurchases = purchRes.status === "fulfilled" ? purchRes.value || [] : [];
      const safeLand = landRes.status === "fulfilled" ? landRes.value || [] : [];
      const safeCycles = cycleRes.status === "fulfilled" ? cycleRes.value || [] : [];
      const safeLogs = logRes.status === "fulfilled" ? logRes.value || [] : [];

      const errors = results
        .filter((res) => res.status === "rejected")
        .map((res) => res.reason?.message || "Failed to load data.");

      setBatches(safeBatches);
      setKpis(safeKpis);
      setProductionLogs(safeProd);
      setSales(safeSales);
      setExpenses(safeExpenses);
      setInventory(safeInventory);
      setPurchases(safePurchases);
      setLandLeases(safeLand);
      setCropCycles(safeCycles);
      setFarmingLogs(safeLogs);
      
      setModuleCounts({
        productionLogs: safeProd.length,
        sales: safeSales.length,
        expenses: safeExpenses.length,
        inventory: safeInventory.length,
        purchases: safePurchases.length,
        landLeases: safeLand.length,
        cropCycles: safeCycles.length,
        farmingLogs: safeLogs.length,
      });

      if (safeBatches.length > 0) {
        const selectedExists = safeBatches.some(
          (batch) => String(batch.id) === selectedBatchId.toString()
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
      console.error("Error loading JGF data:", error);
      setErrorMessage("Failed to load project data.");
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadJgfData(true);
  }, [tenantId, selectedProjectId]);

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

  

  const batchLookup = useMemo(() => {
    return new Map(batches.map((batch) => [String(batch.id), batch]));
  }, [batches]);

  const selectedBatch = useMemo(() => {
    if (!selectedBatchId) {
      return null;
    }
    return batchLookup.get(selectedBatchId) || null;
  }, [batchLookup, selectedBatchId]);

  const getBatchLabel = (batchId) => {
    if (!batchId) return "Unassigned";
    const batch = batchLookup.get(String(batchId));
    if (!batch) return "Unknown";
    return batch.batch_code || batch.batch_name || "Batch";
  };

  // Helper functions for parsing form data
  const parseRequiredInteger = (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const parseNumberOrZero = (value) => {
    if (value === "" || value === null || value === undefined) return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const parseOptionalNumber = (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const normalizeOptional = (value) => {
    if (value === undefined || value === null) return null;
    const trimmed = typeof value === "string" ? value.trim() : value;
    return trimmed === "" ? null : trimmed;
  };

  // BATCH MANAGEMENT
  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    if (!canManage) return;
    if (!selectedProjectId) {
      setErrorMessage("Select a project first.");
      return;
    }

    try {
      resetMessages();
      const payload = {
        batch_code: batchForm.batch_code,
        batch_name: normalizeOptional(batchForm.batch_name),
        product_type: batchForm.product_type,
        start_date: batchForm.start_date,
        raw_groundnuts_kg: parseNumberOrZero(batchForm.raw_groundnuts_kg),
        output_quantity_kg: parseNumberOrZero(batchForm.output_quantity_kg),
        output_units: parseNumberOrZero(batchForm.output_units),
        unit_size_grams: parseNumberOrZero(batchForm.unit_size_grams),
        selling_price_per_unit: parseNumberOrZero(batchForm.selling_price_per_unit),
        status: batchForm.status,
        notes: normalizeOptional(batchForm.notes),
      };

      if (!payload.batch_code || !payload.product_type) {
        setErrorMessage("Batch code and product type are required.");
        return;
      }

      if (editingBatchId) {
        await updateJgfBatch(editingBatchId, payload, tenantId);
        setStatusMessage("Batch updated successfully.");
      } else {
        await createJgfBatch({ ...payload, created_by: user.auth_id }, tenantId, selectedProjectId);
        setStatusMessage(`New ${selectedProject?.name || "project"} batch created.`);
        setBatchForm(initialBatchForm);
      }
      setEditingBatchId(null);
      setShowBatchForm(false);
      loadJgfData(false);
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to save batch.");
    }
  };

  const handleEditBatch = (batch) => {
    setBatchForm({
      batch_code: batch.batch_code || "",
      batch_name: batch.batch_name || "",
      product_type: batch.product_type || "peanut_butter",
      start_date: batch.start_date || today,
      raw_groundnuts_kg: batch.raw_groundnuts_kg || "",
      output_quantity_kg: batch.output_quantity_kg || "",
      output_units: batch.output_units || "",
      unit_size_grams: batch.unit_size_grams || "500",
      selling_price_per_unit: batch.selling_price_per_unit || "",
      status: batch.status || "in_progress",
      notes: batch.notes || "",
    });
    setEditingBatchId(batch.id);
    setShowBatchForm(true);
    setActiveTab("batches");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteBatch = async (batchId) => {
    if (!canManage || !window.confirm("Delete this batch? All related records will be removed.")) return;
    try {
      resetMessages();
      await deleteJgfBatch(batchId, tenantId);
      setStatusMessage("Batch deleted.");
      if (selectedBatchId === String(batchId)) {
        setSelectedBatchId("");
      }
      loadJgfData(false);
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to delete batch.");
    }
  };

  // SALES MANAGEMENT
  const handleSalesSubmit = async (e) => {
    e.preventDefault();
    if (!canManage) return;
    if (!selectedProjectId) {
      setErrorMessage("Select a project first.");
      return;
    }

    try {
      resetMessages();
      const payload = {
        batch_id: normalizeOptional(salesForm.batch_id),
        sale_date: salesForm.sale_date,
        product_type: salesForm.product_type,
        quantity_units: parseNumberOrZero(salesForm.quantity_units),
        unit_price: parseNumberOrZero(salesForm.unit_price),
        total_amount: parseNumberOrZero(salesForm.quantity_units) * parseNumberOrZero(salesForm.unit_price),
        customer_name: normalizeOptional(salesForm.customer_name),
        customer_type: salesForm.customer_type,
        payment_status: salesForm.payment_status,
        payment_method: salesForm.payment_method,
        notes: normalizeOptional(salesForm.notes),
      };

      if (!payload.product_type || !payload.quantity_units) {
        setErrorMessage("Product type and quantity are required.");
        return;
      }

      if (editingSalesId) {
        await updateJgfSale(editingSalesId, payload, tenantId);
        setStatusMessage("Sale updated successfully.");
      } else {
        await createJgfSale({ ...payload, created_by: user.auth_id }, tenantId, selectedProjectId);
        setStatusMessage("New sale recorded.");
        setSalesForm({
          ...initialSalesForm,
          batch_id: selectedBatchId || "", // Keep current batch selection
          sale_date: salesForm.sale_date, // Keep date
        });
      }
      setEditingSalesId(null);
      setShowSalesForm(false);
      loadJgfData(false);
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to save sale record.");
    }
  };

  const handleEditSale = (sale) => {
    setSalesForm({
      batch_id: sale.batch_id || "",
      sale_date: sale.sale_date || today,
      product_type: sale.product_type || "peanut_butter",
      quantity_units: sale.quantity_units || "",
      unit_price: sale.unit_price || "",
      total_amount: sale.total_amount || "",
      customer_name: sale.customer_name || "",
      customer_type: sale.customer_type || "retail",
      payment_status: sale.payment_status || "paid",
      payment_method: sale.payment_method || "cash",
      notes: sale.notes || "",
    });
    setEditingSalesId(sale.id);
    setActiveTab("sales");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteSale = async (saleId) => {
    if (!canManage || !window.confirm("Delete this sale record?")) return;
    try {
      resetMessages();
      await deleteJgfSale(saleId, tenantId);
      setStatusMessage("Sale record deleted.");
      loadJgfData(false);
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to delete sale record.");
    }
  };

  // LAND LEASE MANAGEMENT
  const handleLandLeaseSubmit = async (e) => {
    e.preventDefault();
    if (!canManage) return;
    if (!selectedProjectId) {
      setErrorMessage("Select a project first.");
      return;
    }

    try {
      resetMessages();
      const payload = {
        name: landLeaseForm.name,
        location: normalizeOptional(landLeaseForm.location),
        size_acres: parseNumberOrZero(landLeaseForm.size_acres),
        lease_cost: parseNumberOrZero(landLeaseForm.lease_cost),
        start_date: landLeaseForm.start_date,
        end_date: normalizeOptional(landLeaseForm.end_date),
        landowner_name: normalizeOptional(landLeaseForm.landowner_name),
        landowner_contact: normalizeOptional(landLeaseForm.landowner_contact),
        status: landLeaseForm.status,
        notes: normalizeOptional(landLeaseForm.notes),
      };

      if (!payload.name) {
        setErrorMessage("Lease name is required.");
        return;
      }

      if (editingLandLeaseId) {
        await updateJgfLandLease(editingLandLeaseId, payload, tenantId);
        setStatusMessage("Land lease updated successfully.");
      } else {
        await createJgfLandLease({ ...payload, created_by: user.auth_id }, tenantId, selectedProjectId);
        setStatusMessage("New land lease created.");
        setLandLeaseForm(initialLandLeaseForm);
      }
      setEditingLandLeaseId(null);
      loadJgfData(false);
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to save land lease.");
    }
  };

  const handleEditLandLease = (lease) => {
    setLandLeaseForm({
      name: lease.name || "",
      location: lease.location || "",
      size_acres: lease.size_acres || "",
      lease_cost: lease.lease_cost || "",
      start_date: lease.start_date || today,
      end_date: lease.end_date || "",
      landowner_name: lease.landowner_name || "",
      landowner_contact: lease.landowner_contact || "",
      status: lease.status || "active",
      notes: lease.notes || "",
    });
    setEditingLandLeaseId(lease.id);
    setActiveTab("land");
    setShowLandLeaseForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteLandLease = async (leaseId) => {
    if (!canManage || !window.confirm("Delete this lease? Related crop cycles will be affected.")) return;
    try {
      resetMessages();
      await deleteJgfLandLease(leaseId, tenantId);
      setStatusMessage("Land lease deleted.");
      loadJgfData(false);
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to delete land lease.");
    }
  };

  // CROP CYCLE MANAGEMENT
  const handleCropCycleSubmit = async (e) => {
    e.preventDefault();
    if (!canManage) return;
    if (!selectedProjectId) {
      setErrorMessage("Select a project first.");
      return;
    }

    try {
      resetMessages();
      const payload = {
        lease_id: parseRequiredInteger(cropCycleForm.lease_id),
        cycle_name: cropCycleForm.cycle_name,
        crop_variety: cropCycleForm.crop_variety,
        start_date: cropCycleForm.start_date,
        end_date: normalizeOptional(cropCycleForm.end_date),
        status: cropCycleForm.status,
        projected_yield_kg: parseNumberOrZero(cropCycleForm.projected_yield_kg),
        actual_yield_kg: parseNumberOrZero(cropCycleForm.actual_yield_kg),
        notes: normalizeOptional(cropCycleForm.notes),
      };

      if (!payload.cycle_name) {
        setErrorMessage("Cycle name is required.");
        return;
      }

      if (editingCropCycleId) {
        await updateJgfCropCycle(editingCropCycleId, payload, tenantId);
        setStatusMessage("Crop cycle updated successfully.");
      } else {
        await createJgfCropCycle({ ...payload, created_by: user.auth_id }, tenantId, selectedProjectId);
        setStatusMessage("New crop cycle created.");
        setCropCycleForm(initialCropCycleForm);
      }
      setEditingCropCycleId(null);
      setShowCropCycleForm(false);
      loadJgfData(false);
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to save crop cycle.");
    }
  };

  const handleEditCropCycle = (cycle) => {
    setCropCycleForm({
      lease_id: cycle.lease_id || "",
      cycle_name: cycle.cycle_name || "",
      crop_variety: cycle.crop_variety || "Groundnuts",
      start_date: cycle.start_date || today,
      end_date: cycle.end_date || "",
      status: cycle.status || "planned",
      projected_yield_kg: cycle.projected_yield_kg || "",
      actual_yield_kg: cycle.actual_yield_kg || "",
      notes: cycle.notes || "",
    });
    setEditingCropCycleId(cycle.id);
    // Switch to farming tab or specific sub-view if implemented
    setActiveTab("farming");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteCropCycle = async (cycleId) => {
    if (!canManage || !window.confirm("Delete this crop cycle?")) return;
    try {
      resetMessages();
      await deleteJgfCropCycle(cycleId, tenantId);
      setStatusMessage("Crop cycle deleted.");
      loadJgfData(false);
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to delete crop cycle.");
    }
  };

  // FARMING LOG MANAGEMENT
  const handleFarmingLogSubmit = async (e) => {
    e.preventDefault();
    if (!canManage) return;
    if (!selectedProjectId) {
      setErrorMessage("Select a project first.");
      return;
    }

    try {
      resetMessages();
      const payload = {
        cycle_id: parseRequiredInteger(farmingLogForm.cycle_id),
        activity_date: farmingLogForm.activity_date,
        activity_type: farmingLogForm.activity_type,
        description: normalizeOptional(farmingLogForm.description),
        labour_cost: parseNumberOrZero(farmingLogForm.labour_cost),
        input_cost: parseNumberOrZero(farmingLogForm.input_cost),
        equipment_cost: parseNumberOrZero(farmingLogForm.equipment_cost),
        other_cost: parseNumberOrZero(farmingLogForm.other_cost),
        notes: normalizeOptional(farmingLogForm.notes),
      };

      if (!payload.cycle_id) {
        setErrorMessage("Please select a crop cycle.");
        return;
      }

      if (editingFarmingLogId) {
        await updateJgfFarmingLog(editingFarmingLogId, payload, tenantId);
        setStatusMessage("Farming log updated successfully.");
      } else {
        await createJgfFarmingLog({ ...payload, created_by: user.auth_id }, tenantId, selectedProjectId);
        setStatusMessage("New activity logged.");
        setFarmingLogForm({
            ...initialFarmingLogForm,
            cycle_id: farmingLogForm.cycle_id, // keep cycle selected
            activity_date: farmingLogForm.activity_date 
        });
      }
      setEditingFarmingLogId(null);
      setShowFarmingLogForm(false);
      loadJgfData(false);
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to save farming activity.");
    }
  };

  const handleEditFarmingLog = (log) => {
    setFarmingLogForm({
      cycle_id: log.cycle_id || "",
      activity_date: log.activity_date || today,
      activity_type: log.activity_type || "scouting",
      description: log.description || "",
      labour_cost: log.labour_cost || "",
      input_cost: log.input_cost || "",
      equipment_cost: log.equipment_cost || "",
      other_cost: log.other_cost || "",
      notes: log.notes || "",
    });
    setEditingFarmingLogId(log.id);
    setActiveTab("history");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteFarmingLog = async (logId) => {
    if (!canManage || !window.confirm("Delete this activity log?")) return;
    try {
      resetMessages();
      await deleteJgfFarmingLog(logId, tenantId);
      setStatusMessage("Activity log deleted.");
      loadJgfData(false);
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to delete activity log.");
    }
  };

  // Other section renderers and logic similar to JPP page would go here
  // For brevity, defaulting to a simplified view for now

  if (projectsLoading || loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading {selectedProject?.name || "groundnut"} project data...</p>
      </div>
    );
  }

  if (!selectedProjectId && moduleProjects.length === 0) {
    return (
      <div className="jpp-page">
        <div className="admin-card jpp-empty-card">
          <h3>No groundnut projects yet</h3>
          <p className="admin-help">Create a project to start tracking production.</p>
        </div>
      </div>
    );
  }

  // Calculate totals for overview
  const totalRevenue = sales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netIncome = totalRevenue - totalExpenses;
  const totalSalesCount = sales.reduce((sum, s) => sum + (Number(s.quantity_units) || 0), 0);

  // 30-day revenue comparison
  const msPerDay = 24 * 60 * 60 * 1000;
  const now = new Date();
  const last30Start = new Date(now.getTime() - 30 * msPerDay);
  const prev30Start = new Date(now.getTime() - 60 * msPerDay);

  const revenueLast30 = sales.reduce((sum, s) => {
    const d = s && s.sale_date ? new Date(s.sale_date) : null;
    if (d && !Number.isNaN(d.getTime()) && d >= last30Start) {
      return sum + (Number(s.total_amount) || 0);
    }
    return sum;
  }, 0);

  const revenuePrev30 = sales.reduce((sum, s) => {
    const d = s && s.sale_date ? new Date(s.sale_date) : null;
    if (d && !Number.isNaN(d.getTime()) && d >= prev30Start && d < last30Start) {
      return sum + (Number(s.total_amount) || 0);
    }
    return sum;
  }, 0);

  const revenueDeltaPct = revenuePrev30 === 0 ? null : ((revenueLast30 - revenuePrev30) / revenuePrev30) * 100;

  // Profit margin (net income / revenue)
  const profitMarginPct = totalRevenue === 0 ? null : (netIncome / totalRevenue) * 100;

  return (
    <div className="jpp-page">
      <header className="page-header">
        <div className="page-header-text">
          <h1>{selectedProject?.name || "Groundnut Foods Project"}</h1>
          <p>
            {selectedProject?.tagline ||
              selectedProject?.short_description ||
              "Value-addition agribusiness & nutrition"}
          </p>
        </div>
        <div className="jpp-project-selector">
          <label htmlFor="jgf-project-select">Project</label>
          <select
            id="jgf-project-select"
            value={selectedProjectId}
            onChange={handleProjectChange}
            disabled={moduleProjects.length <= 1}
          >
            {moduleProjects.map((project) => (
              <option key={project.id} value={String(project.id)}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        <div className="jpp-header-badges">
           <button 
             className="btn-icon small" 
             onClick={() => loadJgfData(true)} 
             title="Reload Data"
           >
             <Icon name="refresh" size={18} />
           </button>
        </div>
      </header>
      
      {statusMessage && <div className="jpp-alert success">{statusMessage}</div>}
      {errorMessage && <div className="jpp-alert error">{errorMessage}</div>}

      <div className="jpp-tabs">
        <button
          className={`jpp-tab ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button 
          className={`jpp-tab ${activeTab === "batches" ? "active" : ""}`}
          onClick={() => setActiveTab("batches")}
        >
          Production Batches
        </button>
        <button 
          className={`jpp-tab ${activeTab === "sales" ? "active" : ""}`}
          onClick={() => setActiveTab("sales")}
        >
          Sales & Orders
        </button>
        <button 
           className={`jpp-tab ${activeTab === "inventory" ? "active" : ""}`}
           onClick={() => setActiveTab("inventory")}
        >
           Inventory
        </button>
        <button 
           className={`jpp-tab ${activeTab === "farming" ? "active" : ""}`}
           onClick={() => setActiveTab("farming")}
        >
           Farming
        </button>
          <button
           className={`jpp-tab ${activeTab === "history" ? "active" : ""}`}
           onClick={() => setActiveTab("history")}
          >
           History
          </button>
        <button 
           className={`jpp-tab ${activeTab === "land" ? "active" : ""}`}
           onClick={() => setActiveTab("land")}
        >
           Land & Rentals
        </button>
        
      </div>

      <div className="page-content">
        {activeTab === "overview" && (
          <div className="jpp-overview-tab">
             <div className="jpp-summary-grid">
               <div className="jpp-summary-card">
                 <div className="jpp-summary-top">
                    <span>Total Revenue</span>
                    <Icon name="wallet" size={20} className="text-muted" />
                 </div>
                   <div className="jpp-summary-value">KES {totalRevenue.toLocaleString()}</div>
                   <div className="jpp-summary-sub">
                     {sales.length} sale records
                    <span className="kpi-sub">
                      Last 30d: KES {revenueLast30.toLocaleString()}
                      {revenueDeltaPct === null ? null : (
                        <span className={`kpi-delta ${revenueDeltaPct >= 0 ? 'positive' : 'negative'}`}>
                          {revenueDeltaPct >= 0 ? '▲' : '▼'} {Math.abs(revenueDeltaPct).toFixed(1)}%
                        </span>
                      )}
                    </span>
                   </div>
               </div>
               <div className="jpp-summary-card">
                 <div className="jpp-summary-top">
                    <span>Units Sold</span>
                    <Icon name="tag" size={20} className="text-muted" />
                 </div>
                 <div className="jpp-summary-value">{totalSalesCount}</div>
                 <div className="jpp-summary-sub">All products</div>
               </div>
               <div className="jpp-summary-card">
                 <div className="jpp-summary-top">
                    <span>Expenses</span>
                    <Icon name="receipt" size={20} className="text-muted" />
                 </div>
                 <div className="jpp-summary-value">KES {totalExpenses.toLocaleString()}</div>
                 <div className="jpp-summary-sub">{expenses.length} records</div>
               </div>
               <div className="jpp-summary-card">
                 <div className="jpp-summary-top">
                    <span>Net Income</span>
                    <Icon name="chart" size={20} className="text-muted" />
                 </div>
                 <div className={`jpp-summary-value ${netIncome >= 0 ? 'text-success' : 'text-danger'}`}>
                   KES {netIncome.toLocaleString()}
                 </div>
                 <div className="jpp-summary-sub">
                   Revenue - Expenses
                   <span className="kpi-sub">
                     Profit Margin: {profitMarginPct === null ? '-' : `${profitMarginPct.toFixed(1)}%`}
                   </span>
                 </div>
               </div>
             </div>

            {/* Active Batches table removed from Overview - replace with analytics widgets as needed */}
          </div>
        )}

        {activeTab === "batches" && (
          <div className="jpp-tab-content">
            {(showBatchForm || editingBatchId) ? (
              canManage && (
                <div className="admin-card mb-6">
                 <div className="section-header">
                    <h3>{editingBatchId ? "Edit Batch" : "Start New Batch"}</h3>
                 </div>
                <form className="admin-form" onSubmit={handleBatchSubmit}>
                  <div className="admin-form-grid three-col">
                    <div className="admin-form-field">
                      <label>Batch Code *</label>
                      <input
                        type="text"
                        value={batchForm.batch_code}
                        onChange={(e) => setBatchForm({ ...batchForm, batch_code: e.target.value })}
                        required
                        placeholder={`e.g. ${selectedProject?.code || "JGF"}-2026-01`}
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>Product Type *</label>
                      <select
                        value={batchForm.product_type}
                        onChange={(e) => setBatchForm({ ...batchForm, product_type: e.target.value })}
                        required
                      >
                        {productTypes.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="admin-form-field">
                      <label>Start Date</label>
                      <input
                        type="date"
                        value={batchForm.start_date}
                        onChange={(e) => setBatchForm({ ...batchForm, start_date: e.target.value })}
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>Raw Groundnuts (kg)</label>
                      <input
                        type="number"
                        value={batchForm.raw_groundnuts_kg}
                        onChange={(e) => setBatchForm({ ...batchForm, raw_groundnuts_kg: e.target.value })}
                        placeholder="Input kg"
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>Output Quantity (kg)</label>
                      <input
                        type="number"
                        value={batchForm.output_quantity_kg}
                        onChange={(e) => setBatchForm({ ...batchForm, output_quantity_kg: e.target.value })}
                        placeholder="Output kg"
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>Output Units</label>
                      <input
                        type="number"
                        value={batchForm.output_units}
                        onChange={(e) => setBatchForm({ ...batchForm, output_units: e.target.value })}
                        placeholder="Jars/Packets"
                      />
                    </div>
                     <div className="admin-form-field">
                      <label>Unit Size (g)</label>
                      <input
                        type="number"
                        value={batchForm.unit_size_grams}
                        onChange={(e) => setBatchForm({ ...batchForm, unit_size_grams: e.target.value })}
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>Status</label>
                      <select
                        value={batchForm.status}
                        onChange={(e) => setBatchForm({ ...batchForm, status: e.target.value })}
                      >
                        <option value="planned">Planned</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div className="admin-form-field">
                      <label>Selling Price (per unit)</label>
                      <input
                        type="number"
                        value={batchForm.selling_price_per_unit}
                        onChange={(e) => setBatchForm({ ...batchForm, selling_price_per_unit: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="admin-form-actions">
                    <button type="submit" className="btn-primary">
                      {editingBatchId ? "Update Batch" : "Create Batch"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setEditingBatchId(null);
                        setBatchForm(initialBatchForm);
                        setShowBatchForm(false);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
                </div>
              )
            ) : (
                <div className="admin-card">
                  <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <h3>Production Batches</h3>
                    {canManage && (
                      <div style={{ display: 'flex', gap: '10px' }}>
                         <button 
                           className="btn-primary small" 
                           onClick={() => setShowBatchForm(true)}
                           style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                         >
                           <Icon name="plus" size={16} /> New Batch
                         </button>
                      </div>
                    )}
                  </div>
                <div className="jpp-table-wrap">
                  <table className="jpp-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Product</th>
                        <th>Start Date</th>
                        <th>Status</th>
                        <th>Input (kg)</th>
                        <th>Output (Units)</th>
                        {canManage && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {batches.length === 0 ? (
                        <tr>
                          <td colSpan={canManage ? 7 : 6} className="text-center">No batches found</td>
                        </tr>
                      ) : (
                        batches.map((batch) => (
                          <tr key={batch.id} className={editingBatchId === batch.id ? "editing-row" : ""}>
                            <td>{batch.batch_code}</td>
                            <td>{productTypes.find(t => t.value === batch.product_type)?.label || batch.product_type}</td>
                            <td>{batch.start_date}</td>
                            <td>
                              <span className={`status-badge ${batch.status === 'in_progress' ? 'active' : ''}`}>
                                {batch.status}
                              </span>
                            </td>
                            <td>{batch.raw_groundnuts_kg || "-"}</td>
                            <td>{batch.output_units || "-"}</td>
                            {canManage && (
                              <td className="actions-cell">
                                <button
                                  className="btn-icon small"
                                  onClick={() => handleEditBatch(batch)}
                                  title="Edit"
                                >
                                  <Icon name="edit" size={14} />
                                </button>
                                <button
                                  className="btn-icon small danger"
                                  onClick={() => handleDeleteBatch(batch.id)}
                                  title="Delete"
                                >
                                  <Icon name="trash" size={14} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                </div>
            )}
          </div>
        )}

        {activeTab === "sales" && (
           <div className="jpp-tab-content">

             {(showSalesForm || editingSalesId) ? (
               canManage && (
                 <div className="admin-card mb-6">
                   <div className="section-header">
                     <h3>{editingSalesId ? "Edit Sale Record" : "New Sale Record"}</h3>
                 </div>
               <form className="admin-form" onSubmit={handleSalesSubmit}>
                 <div className="admin-form-grid three-col">
                   <div className="admin-form-field">
                     <label>Sale Date *</label>
                     <input
                       type="date"
                       value={salesForm.sale_date}
                       onChange={(e) => setSalesForm({ ...salesForm, sale_date: e.target.value })}
                       required
                     />
                   </div>
                   <div className="admin-form-field">
                     <label>Product Type *</label>
                     <select
                       value={salesForm.product_type}
                       onChange={(e) => setSalesForm({ ...salesForm, product_type: e.target.value })}
                       required
                     >
                       {productTypes.map((type) => (
                         <option key={type.value} value={type.value}>{type.label}</option>
                       ))}
                     </select>
                   </div>
                   <div className="admin-form-field">
                     <label>Batch (Optional)</label>
                     <select
                       value={salesForm.batch_id}
                       onChange={(e) => setSalesForm({ ...salesForm, batch_id: e.target.value })}
                     >
                       <option value="">-- General Sale --</option>
                       {batches.map((b) => (
                         <option key={b.id} value={b.id}>
                           {b.batch_code} ({productTypes.find(t => t.value === b.product_type)?.label})
                         </option>
                       ))}
                     </select>
                   </div>
                   <div className="admin-form-field">
                     <label>Quantity (Units) *</label>
                     <input
                       type="number"
                       value={salesForm.quantity_units}
                       onChange={(e) => setSalesForm({ ...salesForm, quantity_units: e.target.value })}
                       required
                       min="1"
                     />
                   </div>
                   <div className="admin-form-field">
                     <label>Unit Price *</label>
                     <input
                       type="number"
                       value={salesForm.unit_price}
                       onChange={(e) => setSalesForm({ ...salesForm, unit_price: e.target.value })}
                       required
                     />
                   </div>
                   <div className="admin-form-field">
                     <label>Total Amount</label>
                     <div className="readonly-field">
                       KES {(parseNumberOrZero(salesForm.quantity_units) * parseNumberOrZero(salesForm.unit_price)).toLocaleString()}
                     </div>
                   </div>
                   <div className="admin-form-field">
                     <label>Customer Name</label>
                     <input
                       type="text"
                       value={salesForm.customer_name}
                       onChange={(e) => setSalesForm({ ...salesForm, customer_name: e.target.value })}
                       placeholder="Walking Customer"
                     />
                   </div>
                   <div className="admin-form-field">
                     <label>Payment Method</label>
                     <select
                       value={salesForm.payment_method}
                       onChange={(e) => setSalesForm({ ...salesForm, payment_method: e.target.value })}
                     >
                       {paymentMethods.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                     </select>
                   </div>
                   <div className="admin-form-field">
                     <label>Status</label>
                     <select
                       value={salesForm.payment_status}
                       onChange={(e) => setSalesForm({ ...salesForm, payment_status: e.target.value })}
                     >
                       <option value="paid">Paid</option>
                       <option value="pending">Pending</option>
                       <option value="partial">Partial</option>
                     </select>
                   </div>
                 </div>

                 <div className="admin-form-actions">
                   <button type="submit" className="btn-primary">
                     {editingSalesId ? "Update Sale" : "Record Sale"}
                   </button>
                   <button
                     type="button"
                     className="btn-secondary"
                     onClick={() => {
                       setEditingSalesId(null);
                       setSalesForm(initialSalesForm);
                       setShowSalesForm(false);
                     }}
                   >
                     Cancel
                   </button>
                 </div>
               </form>
               </div>
               )
             ) : (

             <div className="admin-card">
               <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                 <h3>Recent Sales</h3>
                 {canManage && (
                   <button 
                     className="btn-primary small" 
                     onClick={() => setShowSalesForm(true)}
                     style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                   >
                     <Icon name="plus" size={16} /> New Sale
                   </button>
                 )}
               </div>
             <div className="jpp-table-wrap">
               <table className="jpp-table">
                 <thead>
                   <tr>
                     <th>Date</th>
                     <th>Product</th>
                     <th>Customer</th>
                     <th>Qty</th>
                     <th>Total (KES)</th>
                     <th>Status</th>
                     {canManage && <th>Actions</th>}
                   </tr>
                 </thead>
                 <tbody>
                   {sales.length === 0 ? (
                     <tr><td colSpan={canManage ? 7 : 6} className="text-center">No sales recorded</td></tr>
                   ) : (
                     sales.map((sale) => (
                       <tr key={sale.id}>
                         <td>{sale.sale_date}</td>
                         <td>{productTypes.find(t => t.value === sale.product_type)?.label || sale.product_type}</td>
                         <td>{sale.customer_name || "Walk-in"}</td>
                         <td>{sale.quantity_units}</td>
                         <td>{Number(sale.total_amount).toLocaleString()}</td>
                         <td>
                           <span className={`status-badge ${sale.payment_status === 'paid' ? 'success' : 'warning'}`}>
                             {sale.payment_status}
                           </span>
                         </td>
                         {canManage && (
                           <td className="actions-cell">
                             <button className="btn-icon small" onClick={() => handleEditSale(sale)}>
                               <Icon name="edit" size={14} />
                             </button>
                             <button className="btn-icon small danger" onClick={() => handleDeleteSale(sale.id)}>
                               <Icon name="trash" size={14} />
                             </button>
                           </td>
                         )}
                       </tr>
                     ))
                   )}
                 </tbody>
               </table>
             </div>
             </div>
           )}
           </div>
        )}

        {activeTab === "farming" && (
          <div className="jpp-tab-content">
            {/* Farming tab simplified: show only Plan New Crop Cycle card */}

            {/* CROP CYCLES SECTION - always render the plan card for managers */}
            {canManage && (
              <div className="admin-card mb-6">
                <div className="section-header">
                  <h3>{editingCropCycleId ? "Edit Crop Cycle" : "Plan New Crop Cycle"}</h3>
                </div>
                <form className="admin-form" onSubmit={handleCropCycleSubmit}>
                  <div className="admin-form-grid three-col">
                    <div className="admin-form-field">
                      <label>Cycle Name *</label>
                      <input
                        type="text"
                        value={cropCycleForm.cycle_name}
                        onChange={(e) => setCropCycleForm({ ...cropCycleForm, cycle_name: e.target.value })}
                        required
                        placeholder="e.g. Season 1 2026 - North Field"
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>Lease / Land *</label>
                      <select
                        value={cropCycleForm.lease_id}
                        onChange={(e) => setCropCycleForm({ ...cropCycleForm, lease_id: e.target.value })}
                        required
                      >
                         <option value="">Select Land Lease</option>
                         {landLeases.filter(l => l.status === 'active').map(lease => (
                           <option key={lease.id} value={lease.id}>{lease.name} ({lease.size_acres} ac)</option>
                         ))}
                      </select>
                    </div>
                    <div className="admin-form-field">
                      <label>Crop Variety</label>
                       <input
                        type="text"
                        value={cropCycleForm.crop_variety}
                        onChange={(e) => setCropCycleForm({ ...cropCycleForm, crop_variety: e.target.value })}
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>Start Date</label>
                      <input
                        type="date"
                        value={cropCycleForm.start_date}
                        onChange={(e) => setCropCycleForm({ ...cropCycleForm, start_date: e.target.value })}
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>Projected Yield (kg)</label>
                      <input
                        type="number"
                        value={cropCycleForm.projected_yield_kg}
                        onChange={(e) => setCropCycleForm({ ...cropCycleForm, projected_yield_kg: e.target.value })}
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>Status</label>
                      <select
                        value={cropCycleForm.status}
                        onChange={(e) => setCropCycleForm({ ...cropCycleForm, status: e.target.value })}
                      >
                        <option value="planned">Planned</option>
                        <option value="active">Active</option>
                        <option value="harvested">Harvested</option>
                        <option value="completed">Completed</option>
                        <option value="failed">Failed</option>
                      </select>
                    </div>
                    <div className="admin-form-field full-width">
                      <label>Notes</label>
                       <textarea
                        value={cropCycleForm.notes}
                        onChange={(e) => setCropCycleForm({ ...cropCycleForm, notes: e.target.value })}
                        rows={1}
                      />
                    </div>
                  </div>
                  <div className="admin-form-actions">
                    <button type="submit" className="btn-primary">
                      {editingCropCycleId ? "Update Cycle" : "create Cycle"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setEditingCropCycleId(null);
                        setCropCycleForm(initialCropCycleForm);
                        setShowCropCycleForm(false);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

          </div>
        )}

        {activeTab === "history" && (
          <div className="jpp-tab-content">
            {(showFarmingLogForm || editingFarmingLogId) ? (
              canManage && (
                <div className="admin-card mb-6">
                  <div className="section-header">
                    <h3>{editingFarmingLogId ? "Edit Activity Log" : "Log Daily Activity"}</h3>
                  </div>
                  <form className="admin-form" onSubmit={handleFarmingLogSubmit}>
                    <div className="admin-form-grid three-col">
                      <div className="admin-form-field">
                        <label>Date *</label>
                        <input
                          type="date"
                          value={farmingLogForm.activity_date}
                          onChange={(e) => setFarmingLogForm({ ...farmingLogForm, activity_date: e.target.value })}
                          required
                        />
                      </div>
                      <div className="admin-form-field">
                        <label>For Cycle *</label>
                        <select
                          value={farmingLogForm.cycle_id}
                          onChange={(e) => setFarmingLogForm({ ...farmingLogForm, cycle_id: e.target.value })}
                          required
                        >
                          <option value="">Select Crop Cycle</option>
                          {cropCycles.filter(c => ['planned','active','harvested'].includes(c.status)).map(cycle => (
                            <option key={cycle.id} value={cycle.id}>{cycle.cycle_name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="admin-form-field">
                        <label>Activity Type</label>
                        <select
                          value={farmingLogForm.activity_type}
                          onChange={(e) => setFarmingLogForm({ ...farmingLogForm, activity_type: e.target.value })}
                        >
                          <option value="scouting">Scouting</option>
                          <option value="planting">Planting</option>
                          <option value="weeding">Weeding</option>
                          <option value="fertilizing">Fertilizing</option>
                          <option value="spraying">Spraying</option>
                          <option value="harvesting">Harvesting</option>
                          <option value="drying">Drying</option>
                          <option value="shelling">Shelling</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className="admin-form-field full-width">
                        <label>Description</label>
                        <input
                          type="text"
                          value={farmingLogForm.description}
                          onChange={(e) => setFarmingLogForm({ ...farmingLogForm, description: e.target.value })}
                          placeholder="Details of activity..."
                        />
                      </div>
                      <div className="admin-form-field">
                        <label>Labour Cost</label>
                        <input
                          type="number"
                          value={farmingLogForm.labour_cost}
                          onChange={(e) => setFarmingLogForm({ ...farmingLogForm, labour_cost: e.target.value })}
                        />
                      </div>
                      <div className="admin-form-field">
                        <label>Input Cost</label>
                        <input
                          type="number"
                          value={farmingLogForm.input_cost}
                          onChange={(e) => setFarmingLogForm({ ...farmingLogForm, input_cost: e.target.value })}
                        />
                      </div>
                      <div className="admin-form-field">
                        <label>Equipment Cost</label>
                        <input
                          type="number"
                          value={farmingLogForm.equipment_cost}
                          onChange={(e) => setFarmingLogForm({ ...farmingLogForm, equipment_cost: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="admin-form-actions">
                      <button type="submit" className="btn-primary">
                        {editingFarmingLogId ? "Update Log" : "Add Log Entry"}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setEditingFarmingLogId(null);
                          setFarmingLogForm(initialFarmingLogForm);
                          setShowFarmingLogForm(false);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )
            ) : (

            <div className="admin-card">
               <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                 <h3>Recent Farming Logs</h3>
               </div>
               <div className="jpp-table-wrap">
                 <table className="jpp-table">
                   <thead>
                     <tr>
                       <th>Date</th>
                       <th>Cycle</th>
                       <th>Activity</th>
                       <th>Description</th>
                       <th>Total Cost</th>
                       {canManage && <th>Actions</th>}
                     </tr>
                   </thead>
                   <tbody>
                     {farmingLogs.length === 0 ? (
                       <tr><td colSpan={canManage ? 6 : 5} className="text-center">No logs recorded</td></tr>
                     ) : (
                       farmingLogs.map((log) => {
                          const cycle = cropCycles.find(c => c.id === log.cycle_id);
                          const totalCost = (Number(log.labour_cost)||0) + (Number(log.input_cost)||0) + (Number(log.equipment_cost)||0) + (Number(log.other_cost)||0);
                          return (
                           <tr key={log.id}>
                             <td>{log.activity_date}</td>
                             <td>{cycle ? cycle.cycle_name : "Unknown"}</td>
                             <td>
                               <span className="status-badge primary">{log.activity_type}</span>
                             </td>
                             <td>{log.description}</td>
                             <td>{totalCost > 0 ? totalCost.toLocaleString() : "-"}</td>
                             {canManage && (
                               <td className="actions-cell">
                                 <button className="btn-icon small" onClick={() => handleEditFarmingLog(log)}>
                                   <Icon name="edit" size={14} />
                                 </button>
                                 <button className="btn-icon small danger" onClick={() => handleDeleteFarmingLog(log.id)}>
                                   <Icon name="trash" size={14} />
                                 </button>
                               </td>
                             )}
                           </tr>
                         );
                       })
                     )}
                   </tbody>
                 </table>
               </div>
             </div>
            )}

          </div>
        )}

        {activeTab === "land" && (
          <div className="jpp-tab-content">
            {(showLandLeaseForm || editingLandLeaseId) && canManage && (
               <div className="admin-card mb-6">
                 <div className="section-header">
                   <h3>{editingLandLeaseId ? "Edit Land Lease" : "Add New Land Lease"}</h3>
                 </div>
                 <form className="admin-form" onSubmit={handleLandLeaseSubmit}>
                  <div className="admin-form-grid two-col">
                    <div className="admin-form-field">
                      <label>Property Name *</label>
                      <input
                        type="text"
                        value={landLeaseForm.name}
                        onChange={(e) => setLandLeaseForm({ ...landLeaseForm, name: e.target.value })}
                        required
                        placeholder="e.g. North Field"
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>Location</label>
                      <input
                        type="text"
                        value={landLeaseForm.location}
                        onChange={(e) => setLandLeaseForm({ ...landLeaseForm, location: e.target.value })}
                        placeholder="Village / Area"
                      />
                    </div>

                    <div className="admin-form-field">
                      <label>Size (Acres)</label>
                      <input
                        type="number"
                        value={landLeaseForm.size_acres}
                        onChange={(e) => setLandLeaseForm({ ...landLeaseForm, size_acres: e.target.value })}
                        step="0.1"
                        placeholder="e.g. 2.5"
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>Lease Cost (KES)</label>
                      <input
                        type="number"
                        value={landLeaseForm.lease_cost}
                        onChange={(e) => setLandLeaseForm({ ...landLeaseForm, lease_cost: e.target.value })}
                        placeholder="e.g. 15000"
                      />
                    </div>

                    <div className="admin-form-field">
                      <label>Start Date</label>
                      <input
                        type="date"
                        value={landLeaseForm.start_date}
                        onChange={(e) => setLandLeaseForm({ ...landLeaseForm, start_date: e.target.value })}
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>End Date</label>
                      <input
                        type="date"
                        value={landLeaseForm.end_date}
                        onChange={(e) => setLandLeaseForm({ ...landLeaseForm, end_date: e.target.value })}
                      />
                    </div>

                    <div className="admin-form-field">
                      <label>Landowner Contact</label>
                      <input
                        type="text"
                        value={landLeaseForm.landowner_contact}
                        onChange={(e) => setLandLeaseForm({ ...landLeaseForm, landowner_contact: e.target.value })}
                        placeholder="Phone or email"
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>Status</label>
                      <select
                        value={landLeaseForm.status}
                        onChange={(e) => setLandLeaseForm({ ...landLeaseForm, status: e.target.value })}
                      >
                        <option value="active">Active</option>
                        <option value="expired">Expired</option>
                        <option value="terminated">Terminated</option>
                      </select>
                    </div>

                    <div className="admin-form-field full-width">
                      <label>Notes</label>
                      <textarea
                        value={landLeaseForm.notes}
                        onChange={(e) => setLandLeaseForm({ ...landLeaseForm, notes: e.target.value })}
                        rows={2}
                      />
                    </div>
                  </div>
                   <div className="admin-form-actions">
                     <button type="submit" className="btn-primary">
                       {editingLandLeaseId ? "Update Lease" : "Add Lease"}
                     </button>
                     <button
                       type="button"
                       className="btn-secondary"
                       onClick={() => {
                         setEditingLandLeaseId(null);
                         setLandLeaseForm(initialLandLeaseForm);
                         setShowLandLeaseForm(false);
                       }}
                     >
                       Cancel
                     </button>
                   </div>
                 </form>
               </div>
            )}

            {!(showLandLeaseForm || editingLandLeaseId) && (
              <div className="admin-card">
                <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  <h3>Leased Properties</h3>
                  {canManage && (
                    <button
                      className="btn-primary small"
                      onClick={() => setShowLandLeaseForm(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Icon name="plus" size={16} /> Add Lease
                    </button>
                  )}
                </div>
                <div className="jpp-table-wrap">
                  <table className="jpp-table">
                    <thead>
                      <tr>
                        <th>Property</th>
                        <th>Location</th>
                        <th>Size (Acres)</th>
                        <th>Lease Cost</th>
                        <th>Period</th>
                        <th>Status</th>
                        {canManage && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {landLeases.length === 0 ? (
                        <tr><td colSpan={canManage ? 7 : 6} className="text-center">No leases recorded</td></tr>
                      ) : (
                        landLeases.map((lease) => (
                          <tr key={lease.id}>
                            <td>
                              <strong>{lease.name}</strong><br/>
                              <span className="text-muted small">{lease.landowner_name}</span>
                            </td>
                            <td>{lease.location}</td>
                            <td>{lease.size_acres}</td>
                            <td>{Number(lease.lease_cost).toLocaleString()}</td>
                            <td>
                              <span className="text-muted small">
                                {lease.start_date}<br/>
                                {lease.end_date || "Ongoing"}
                              </span>
                            </td>
                            <td>
                              <span className={`status-badge ${lease.status === 'active' ? 'success' : 'warning'}`}>
                                {lease.status}
                              </span>
                            </td>
                            {canManage && (
                              <td className="actions-cell">
                                <button className="btn-icon small" onClick={() => handleEditLandLease(lease)}>
                                  <Icon name="edit" size={14} />
                                </button>
                                <button className="btn-icon small danger" onClick={() => handleDeleteLandLease(lease.id)}>
                                  <Icon name="trash" size={14} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "inventory" && (
          <div className="admin-card jpp-empty-card">
            <Icon name="info" size={32} />
            <h3>Coming Soon</h3>
            <p>This section is under development. Check back soon for inventory and expense tracking features.</p>
            <button className="btn-secondary" onClick={() => setActiveTab("overview")}>Back to Overview</button>
          </div>
        )}

      </div>
    </div>
  );
}

export { JgfProjectPage };
export default JgfProjectPage;
