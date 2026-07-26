import { useState, useEffect, useRef } from 'react'
import './App.css'

// --- SUPABASE IMPORTS ---
import { supabase } from './supabase'

// --- ASSETS ---
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const tripCardEmojis = ['🧳', '🌎', '🏝️', '🏔️', '🏙️', '🗺️', '🚗', '🚆', '🚢', '🏕️', '🌅', '📍'];

function App() {
  // --- USER STATE ---
  const [user, setUser] = useState(null)

  // --- ERROR STATE ---
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  // --- NAVIGATION STATE ---
  const [view, setView] = useState('login')
  const [activeTripId, setActiveTripId] = useState(null)
  const [activeLocation, setActiveLocation] = useState(null)

  // --- DATA STATE ---
  const [trips, setTrips] = useState([])
  const [newFolderName, setNewFolderName] = useState('')
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isClearingTrips, setIsClearingTrips] = useState(false)
  const [tripEmojiMap, setTripEmojiMap] = useState({})

  // --- EDITING STATES ---
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [tempTitle, setTempTitle] = useState('')

  // --- BACKGROUND PICKER STATE ---
  const [showBgPicker, setShowBgPicker] = useState(null)
  const [customImageUrl, setCustomImageUrl] = useState('')
  const fileInputRef = useRef(null)

  // --- RECEIPT BUILDER STATE ---
  const [receiptLoc, setReceiptLoc] = useState('')
  const [receiptPayer, setReceiptPayer] = useState('')
  const [taxMode, setTaxMode] = useState('$')
  const [tipMode, setTipMode] = useState('$')
  const [receiptTax, setReceiptTax] = useState('')
  const [receiptTip, setReceiptTip] = useState('')
  const [currentItems, setCurrentItems] = useState([])

  // Item Inputs
  const [itemName, setItemName] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [selectedConsumers, setSelectedConsumers] = useState([])
  const [sessionPeople, setSessionPeople] = useState([])
  const [newPersonName, setNewPersonName] = useState('')
  const [hoveredChip, setHoveredChip] = useState(null) // NEW: Tracks which chip is being hovered

  // EDITING EXPENSE STATE
  const [editingIndex, setEditingIndex] = useState(null)
  const [editingTripExpenseId, setEditingTripExpenseId] = useState(null)
  const [editingLocationBatch, setEditingLocationBatch] = useState(null);

  // Results
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  // ==========================================
  // HELPER: GET DATA
  // ==========================================
  const activeTrip = trips.find(t => t.id === activeTripId)
  const isTripManager = (trip) => {
    if (!user || !trip) return false;
    return trip.owner_id === user.id || trip.user_role === 'admin' || trip.user_role === 'owner';
  };
  const manageableTrips = trips.filter(isTripManager);

  const locationExpenses = activeTrip
    ? activeTrip.expenses.filter(e => e.location === activeLocation).sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt))
    : []

  const tripLocations = activeTrip
    ? [...new Set(activeTrip.expenses.map(e => e.location))]
    : []

  const activeReceiptTheme = activeTrip?.themes?.[activeLocation] || null;

  // ==========================================
  // CONSUMER CHIP LOGIC
  // ==========================================
  // 1. Extract raw people and filter out duplicates ignoring case
  const rawPeople = activeTrip?.expenses?.flatMap(e => e.involved) || [];
  const uniquePeopleMap = new Map();
  rawPeople.forEach(p => {
    if (!uniquePeopleMap.has(p.toLowerCase())) {
      uniquePeopleMap.set(p.toLowerCase(), p); // Keeps the first capitalization it finds
    }
  });

  const existingPeople = Array.from(uniquePeopleMap.values());
  const myName = user?.user_metadata?.full_name?.split(' ')[0] || user?.user_metadata?.name?.split(' ')[0] || 'Me';

  // Ensure current user is an option
  if (!uniquePeopleMap.has(myName.toLowerCase())) {
    existingPeople.unshift(myName);
  }

  const allAvailablePeople = Array.from(new Set([...existingPeople, ...sessionPeople]));

  const handleAddNewPerson = (e) => {
    e.preventDefault();
    if (!newPersonName.trim()) return;

    // Auto-capitalize the typed name (e.g., "john" -> "John", "el john" -> "El John")
    const formattedName = newPersonName
      .trim()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    // Check if a variation of this name already exists (prevents duplicate chips)
    const existingMatch = allAvailablePeople.find(p => p.toLowerCase() === formattedName.toLowerCase());
    const finalNameToUse = existingMatch || formattedName;

    if (!existingMatch && !sessionPeople.includes(finalNameToUse)) {
      setSessionPeople([...sessionPeople, finalNameToUse]);
    }

    if (!selectedConsumers.includes(finalNameToUse)) {
      setSelectedConsumers([...selectedConsumers, finalNameToUse]);
    }

    setNewPersonName('');
  }

  const toggleConsumer = (name) => {
    if (selectedConsumers.includes(name)) {
      setSelectedConsumers(selectedConsumers.filter(n => n !== name));
    } else {
      setSelectedConsumers([...selectedConsumers, name]);
    }
  }

  // ==========================================
  // 1. AUTHENTICATION LISTENER
  // ==========================================
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        setView('dashboard')
      } else {
        setUser(null)
        setView('login')
        setTrips([])
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ==========================================
  // 2. DATABASE SYNC (READ/WRITE)
  // ==========================================
  useEffect(() => {
    if (!user) return;

    const fetchTrips = async () => {
      const { data, error } = await supabase.rpc('get_my_trips');
      if (error) { console.error("Failed to fetch trips:", error); return; }
      if (data) setTrips(data);
    };

    fetchTrips();

    const channel = supabase
      .channel('trips-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, fetchTrips)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_members' }, fetchTrips)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user]);

  useEffect(() => {
    setTripEmojiMap((currentMap) => {
      const nextMap = {};
      trips.forEach((trip) => {
        nextMap[trip.id] = currentMap[trip.id] || tripCardEmojis[Math.floor(Math.random() * tripCardEmojis.length)];
      });
      return nextMap;
    });
  }, [trips]);

  const updateTripInCloud = async (tripId, updatedData) => {
    if (!user) return;
    const { error } = await supabase
      .from('trips')
      .update({ ...updatedData, last_updated: new Date().toISOString() })
      .eq('id', tripId);
    if (error) {
      console.error("Error updating trip:", error);
      alert("Failed to update trip. Check your connection.");
    }
  };

  // ==========================================
  // AUTH ACTIONS
  // ==========================================
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (error) { console.error(error); alert("Login failed") }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  // ==========================================
  // NAVIGATION ACTIONS
  // ==========================================
  const goHome = () => {
    setView('dashboard')
    setActiveTripId(null)
    setActiveLocation(null)
    setShowBgPicker(null)
    setEditingLocationBatch(null)
  }

  const openTrip = (id) => {
    setActiveTripId(id)
    setView('trip_view')
    setResults([])
  }

  const openLocationTab = (location) => {
    setActiveLocation(location)
    setView('receipt_detail')
  }

  const openReceiptBuilder = () => {
    setReceiptLoc('')
    setReceiptPayer('')
    setReceiptTax('')
    setReceiptTip('')
    setCurrentItems([])
    setQuantity(1)
    setTaxMode('$')
    setTipMode('$')
    setEditingIndex(null)
    setEditingTripExpenseId(null)
    setEditingLocationBatch(null)
    setSelectedConsumers([])
    setSessionPeople([])
    setNewPersonName('')
    setView('receipt_editor')
  }

  // ==========================================
  // BATCH EDIT, PHOTO RESIZE, PDF
  // ==========================================
  const loadReceiptBatch = (location) => {
    const batchExpenses = activeTrip.expenses.filter(e => e.location === location);
    if (batchExpenses.length === 0) return;

    const commonPayer = batchExpenses[0].payer;
    const totalTax = batchExpenses.reduce((sum, e) => sum + e.taxShare, 0);
    const totalTip = batchExpenses.reduce((sum, e) => sum + e.tipShare, 0);

    const builderItems = batchExpenses.map(e => ({
      name: e.rawName || e.item,
      qty: e.rawQty || 1,
      unitPrice: e.rawUnitPrice || (e.originalPrice / (e.rawQty || 1)),
      totalPrice: e.originalPrice,
      consumers: e.involved
    }));

    setReceiptLoc(location);
    setReceiptPayer(commonPayer);
    setReceiptTax(totalTax.toFixed(2));
    setReceiptTip(totalTip.toFixed(2));
    setCurrentItems(builderItems);

    setTaxMode('$');
    setTipMode('$');

    setEditingLocationBatch(location);
    setView('receipt_editor');
  };

  const resizeImageToBlob = (file, maxWidth = 800) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.7);
        };
      };
    });
  };

  const handleReceiptImageUpload = async (e, location) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10000000) return alert("File is way too huge! Please pick something smaller.");
    try {
      const blob = await resizeImageToBlob(file);
      const path = `trips/${activeTripId}/${location}`;
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(path);
      const updatedImages = { ...(activeTrip.receipt_images || {}), [location]: publicUrl };
      await updateTripInCloud(activeTripId, { receipt_images: updatedImages });
    } catch (err) {
      console.error("Image upload error:", err);
      alert("Could not process image.");
    }
  };

  const printReceipt = () => window.print();

  // DATA ACTIONS
  const createFolder = async () => {
    if (!newFolderName.trim()) return;

    const generatedCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const now = new Date().toISOString();
    const safeName = encodeURIComponent(newFolderName.trim());
    const autoBackground = `url(https://image.pollinations.ai/prompt/beautiful%20scenic%20travel%20photography%20of%20${safeName}?width=1280&height=720&nologo=true)`;

    try {
      const { error: tripError } = await supabase.from('trips').insert({
        id: generatedCode,
        name: newFolderName,
        expenses: [],
        themes: {},
        background: autoBackground,
        owner_id: user.id,
        settled_debts: [],
        receipt_images: {},
        created_at: now,
        last_updated: now
      });
      if (tripError) throw tripError;

      const { error: memberError } = await supabase.from('trip_members').insert({
        trip_id: generatedCode,
        user_id: user.id,
        role: 'owner'
      });
      if (memberError) throw memberError;

      setNewFolderName('');
    } catch (e) {
      console.error("Error creating trip:", e);
      alert("Could not create trip. Please try again.");
    }
  };

  const handleJoinTrip = async () => {
    if (!joinCodeInput.trim()) return;
    const formattedCode = joinCodeInput.trim().toUpperCase();
    try {
      const { error } = await supabase.from('trip_members').insert({
        trip_id: formattedCode,
        user_id: user.id,
        role: 'member'
      });
      if (error) {
        if (error.code === '23505') return alert("You're already a member of this trip!");
        if (error.code === '23503') return alert("Trip not found. Check the code and try again.");
        throw error;
      }
      setJoinCodeInput('');
      alert("Successfully joined the trip!");
    } catch (e) {
      console.error("Join Error:", e);
      alert("Could not join that trip. Check the code and try again.");
    }
  };

  const deleteFolder = async (e, id) => {
    e.stopPropagation();
    const tripToDelete = trips.find(trip => trip.id === id);
    if (!isTripManager(tripToDelete)) return alert("Only the trip owner or an admin can delete this trip.");

    if (confirm("Delete this entire trip folder for everyone?")) {
      const { error } = await supabase.from('trips').delete().eq('id', id);
      if (error) console.error("Error deleting trip:", error);
    }
  };

  const clearAllTrips = async () => {
    if (!user || manageableTrips.length === 0 || isClearingTrips) return;
    const tripCount = manageableTrips.length;
    if (!window.confirm(`This will permanently delete ${tripCount} trip${tripCount === 1 ? '' : 's'} you own or administer for everyone. Continue?`)) return;
    if (window.prompt(`Final confirmation: type "CLEAR ${tripCount}" to delete all trips.`) !== `CLEAR ${tripCount}`) return;

    setIsClearingTrips(true);
    try {
      await Promise.all(manageableTrips.map(t => supabase.from('trips').delete().eq('id', t.id)));
      setShowBgPicker(null);
    } catch (err) {
      console.error("Error clearing trips:", err);
    } finally {
      setIsClearingTrips(false);
    }
  };

  const deleteExpense = async (expenseId) => {
    const updatedExpenses = activeTrip.expenses.filter(e => e.id !== expenseId);
    await updateTripInCloud(activeTripId, { expenses: updatedExpenses });
  };

  const updateTripBackground = async (tripId, bgValue) => {
    const { error } = await supabase.from('trips').update({ background: bgValue }).eq('id', tripId);
    if (error) console.error("Update Error:", error);
    setShowBgPicker(null);
  };

  const handleFileUpload = async (e, tripId) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5000000) return alert("Image is too large! Please choose a file smaller than 5MB.");
    try {
      const path = `trips/${tripId}/background`;
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(path);
      updateTripBackground(tripId, `url(${publicUrl})`);
    } catch (err) {
      console.error("Background upload error:", err);
      alert("Could not upload background image.");
    }
  };

  const updateReceiptTheme = async (themeValue) => {
    if (!activeTrip || !activeLocation) return;
    const updatedThemes = { ...(activeTrip.themes || {}), [activeLocation]: themeValue };
    await updateTripInCloud(activeTripId, { themes: updatedThemes });
    setShowBgPicker(null);
  };

  const handleSaveTripName = async () => {
    if (!tempTitle.trim()) return setIsEditingTitle(false);
    await updateTripInCloud(activeTripId, { name: tempTitle });
    setIsEditingTitle(false);
  };

  // --- SETTLEMENT MARKER ---
  const toggleSettlement = async (line) => {
    if (!activeTrip || !activeTripId) return;

    const currentSettled = activeTrip.settled_debts || [];
    const isSettled = currentSettled.includes(line);
    const updated = isSettled ? currentSettled.filter(d => d !== line) : [...currentSettled, line];

    // Optimistic update
    activeTrip.settled_debts = updated;

    const { error } = await supabase
      .from('trips')
      .update({ settled_debts: updated })
      .eq('id', activeTripId);

    if (error) {
      console.error("Error updating settlement status:", error);
      alert("Could not update settlement. Check internet connection.");
    }
  };

  // --- EDIT SAVED EXPENSE ---
  const editSavedExpense = (expense) => {
    setEditingTripExpenseId(expense.id)
    setReceiptLoc(expense.location)
    setReceiptPayer(expense.payer)

    const name = expense.rawName || expense.item.replace(/^\d+x\s/, '')
    const qty = expense.rawQty || 1
    const price = expense.rawUnitPrice || expense.originalPrice / qty

    const reconstructedItem = {
      name: name,
      qty: qty,
      unitPrice: price,
      totalPrice: expense.originalPrice,
      consumers: expense.involved
    }
    setCurrentItems([reconstructedItem])

    setReceiptTax(expense.taxShare.toFixed(2))
    setReceiptTip(expense.tipShare.toFixed(2))
    setTaxMode('$')
    setTipMode('$')
    setEditingLocationBatch(null);
    setView('receipt_editor')
  }

  // --- CALCULATION ---
  const calculateTripSettlement = async () => {
    if (!activeTrip || activeTrip.expenses.length === 0) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-settlements', {
        body: activeTrip.expenses
      });
      if (error) throw error;
      setResults(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Settlement calculation error:", error);
      alert("Failed to calculate settlements. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // --- BUILDER ACTIONS ---
  const handleAddOrUpdateItem = () => {
    if (!itemName || !unitPrice || selectedConsumers.length === 0) return alert("Fill item details and select at least one consumer")
    const qty = parseFloat(quantity) || 1
    const price = parseFloat(unitPrice)
    const totalLineCost = price * qty
    const newItem = {
      name: itemName,
      qty: qty,
      unitPrice: price,
      totalPrice: totalLineCost,
      consumers: selectedConsumers
    }
    if (editingIndex !== null) {
      const updated = [...currentItems]
      updated[editingIndex] = newItem
      setCurrentItems(updated)
      setEditingIndex(null)
    } else {
      setCurrentItems([...currentItems, newItem])
    }
    setItemName('')
    setUnitPrice('')
    setQuantity(1)
    setSelectedConsumers([])
  }

  const startEditingDraftItem = (index) => {
    const item = currentItems[index]
    setItemName(item.name)
    setUnitPrice(item.unitPrice)
    setQuantity(item.qty)
    setSelectedConsumers(item.consumers)
    setEditingIndex(index)
  }

  const saveReceiptToTrip = async () => {
    if (!receiptLoc || !receiptPayer) return alert("Enter Location and Payer");
    if (currentItems.length === 0) return alert("Add items");

    const subtotal = currentItems.reduce((sum, item) => sum + item.totalPrice, 0);
    let taxTotal = parseFloat(receiptTax) || 0;
    let tipTotal = parseFloat(receiptTip) || 0;

    if (taxMode === '%') taxTotal = subtotal * (taxTotal / 100);
    if (tipMode === '%') tipTotal = subtotal * (tipTotal / 100);

    const taxRate = subtotal > 0 ? (taxTotal / subtotal) : 0;
    const tipRate = subtotal > 0 ? (tipTotal / subtotal) : 0;

    const newExpenses = currentItems.map(item => {
      const itemTax = item.totalPrice * taxRate;
      const itemTip = item.totalPrice * tipRate;
      return {
        id: (Date.now() + Math.random()),
        item: `${item.qty}x ${item.name}`,
        location: receiptLoc,
        payer: receiptPayer,
        amount: item.totalPrice + itemTax + itemTip,
        involved: item.consumers,
        rawName: item.name,
        rawQty: item.qty,
        rawUnitPrice: item.unitPrice,
        originalPrice: item.totalPrice,
        taxShare: itemTax,
        tipShare: itemTip,
        createdAt: new Date()
      };
    });

    try {
      let finalExpensesList = activeTrip.expenses;

      if (editingLocationBatch) {
        finalExpensesList = finalExpensesList.filter(e => e.location !== editingLocationBatch);
      } else if (editingTripExpenseId) {
        finalExpensesList = finalExpensesList.filter(e => e.id !== editingTripExpenseId);
      }

      const { error } = await supabase.from('trips').update({
        expenses: [...finalExpensesList, ...newExpenses],
        last_updated: new Date().toISOString()
      }).eq('id', activeTripId);

      if (error) throw error;

      setActiveLocation(receiptLoc);
      setView('receipt_detail');
      setEditingTripExpenseId(null);
      setEditingLocationBatch(null);
    } catch (err) {
      console.error("Save failed:", err);
    }
  };

  const getBreakdown = (expensesList) => {
    const breakdown = {}
    expensesList.forEach(exp => {
      const numPeople = exp.involved.length
      const splitPrice = exp.originalPrice / numPeople
      const splitTax = exp.taxShare / numPeople
      const splitTip = exp.tipShare / numPeople
      const splitTotal = exp.amount / numPeople

      let displayName = exp.item;
      if (exp.rawQty && exp.rawName) {
        // Divide the total quantity by the number of people splitting it
        const splitQty = exp.rawQty / numPeople;

        // Format to avoid long decimals (e.g., 3 sodas / 2 people = 1.5x)
        const formattedQty = Number.isInteger(splitQty) ? splitQty : parseFloat(splitQty.toFixed(2));
        displayName = `${formattedQty}x ${exp.rawName}`;
      } else {
        // Fallback for older legacy expenses before rawQty was added
        const strippedName = exp.item.replace(/^\d+x\s/, '');
        displayName = `(Split) ${strippedName}`;
      }

      exp.involved.forEach(person => {
        if (!breakdown[person]) {
          breakdown[person] = { items: [], subtotal: 0, tax: 0, tip: 0, grandTotal: 0 }
        }
        breakdown[person].items.push({
          name: displayName, // Now uses the dynamically calculated name
          location: exp.location,
          cost: splitPrice
        })
        breakdown[person].subtotal += splitPrice
        breakdown[person].tax += splitTax
        breakdown[person].tip += splitTip
        breakdown[person].grandTotal += splitTotal
      })
    })
    return breakdown
  }

  const updateBackgroundPosition = (e) => {
    const x = `${(e.clientX / window.innerWidth) * 100}%`;
    const y = `${(e.clientY / window.innerHeight) * 100}%`;
    document.documentElement.style.setProperty('--cursor-x', x);
    document.documentElement.style.setProperty('--cursor-y', y);
  };

  // ##########################################
  // MAIN RENDER
  // ##########################################

  if (view === 'login' || !user) {
    return (
      <div className="hero-wrapper">
        <div className="hero-content">
          <div className="hero-text-side">
            <div className="badge-pill">✨ The easiest way to split bills</div>
            <h1 className="hero-title-large">
              Travel more.<br />Worry less.<br /><span className="text-gradient">Split instantly.</span>
            </h1>
            <p className="hero-desc">Track shared expenses for trips, dinners, and roommates. No more awkward math or lost receipts.</p>
            <button className="btn btn-primary btn-large" onClick={handleGoogleLogin}>
              <div style={{ background: 'white', borderRadius: '50%', padding: '4px', display: 'flex', marginRight: '12px' }}>
                <GoogleIcon />
              </div>
              Continue with Google
            </button>
            <div className="trust-badge">
              <div className="avatars"><span className="avatar">👤</span><span className="avatar">😎</span><span className="avatar">🤠</span></div>
              <p>Join your friends on GroupTab</p>
            </div>
          </div>
          <div className="hero-visual-side">
            <div className="mockup-phone">
              <div className="mockup-header"><div className="mockup-notch"></div><div className="mockup-title">NYC Trip 🗽</div></div>
              <div className="mockup-body">
                <div className="mockup-row fade-1"><div className="icon-circle">🍕</div><div className="row-text"><div className="row-title">Joe's Pizza</div><div className="row-sub">Paid by Ashton</div></div><div className="row-price text-red">-$15.00</div></div>
                <div className="mockup-row fade-2"><div className="icon-circle">🚕</div><div className="row-text"><div className="row-title">Uber to Hotel</div><div className="row-sub">Paid by Therese</div></div><div className="row-price text-green">+$8.50</div></div>
                <div className="mockup-row fade-3"><div className="icon-circle">🍸</div><div className="row-text"><div className="row-title">Rooftop Drinks</div><div className="row-sub">Paid by ElJohn</div></div><div className="row-price text-red">-$22.00</div></div>
                <div className="mockup-floating-card float-anim"><span>💸 You owe Wes</span><strong>$22.00</strong></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container" onMouseMove={updateBackgroundPosition}>
      <div className="background-glow"></div>

      {/* HEADER */}
      <div className="no-print" style={{ marginBottom: '20px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <h2 className="header-title" style={{ margin: 0, fontSize: '1.8rem', cursor: 'pointer' }} onClick={goHome}>GroupTab 📁</h2>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '20px' }}>
            {user.user_metadata?.full_name?.split(' ')[0] || user.user_metadata?.name?.split(' ')[0] || 'User'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {view !== 'dashboard' && <button className="back-btn" onClick={goHome}>Home</button>}
          <button className="back-btn" style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }} onClick={handleLogout}>Logout</button>
        </div>
      </div>

      {/* ---------------- VIEW 1: DASHBOARD ---------------- */}
      {view === 'dashboard' && (
        <div className="dashboard-container">
          <div className="dashboard-header">
            <div>
              <h1 className="dash-title">Welcome back, <span className="text-highlight">{user.user_metadata?.full_name?.split(' ')[0] || user.user_metadata?.name?.split(' ')[0] || 'Traveler'}</span></h1>
              <p className="dash-subtitle">Create a trip, join a group, or jump back into recent expenses.</p>
            </div>
            <div className="stat-pill"><span className="stat-num">{trips.length}</span><span className="stat-label">Active Trips</span></div>
          </div>

          <div className="create-bar-container">
            <div className="action-panel">
              <div className="action-title"><span className="action-icon">+</span>Create Trip</div>
              <div className="create-bar">
                <input
                  className="transparent-input"
                  placeholder="Madrid 2026"
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createFolder()}
                />
                <button className="btn-icon" onClick={createFolder}>Create</button>
              </div>
            </div>

            <div className="action-panel">
              <div className="action-title"><span className="action-icon">#</span>Join Trip</div>
              <div className="create-bar">
                <input
                  className="transparent-input"
                  placeholder="AB1234"
                  value={joinCodeInput}
                  maxLength={6}
                  onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinTrip(joinCodeInput)}
                />
                <button className="btn-icon" onClick={() => handleJoinTrip(joinCodeInput)}>Join</button>
              </div>
            </div>
          </div>

          <div className="trips-section">
            <div className="trips-section-header">
              <h3 className="section-title">Your Trips</h3>
              <button className="clear-trips-btn" onClick={clearAllTrips} disabled={manageableTrips.length === 0 || isClearingTrips}>
                {isClearingTrips ? 'Clearing...' : 'Clear All'}
              </button>
            </div>
            {trips.length === 0 ? (
              <div className="empty-state"><div className="empty-icon"></div><p>No trips yet. Type a destination above to get started!</p></div>
            ) : (
              <div className="home-trip-grid">
                {[...trips].sort((a, b) =>
                  new Date(b.last_updated) - new Date(a.last_updated)
                ).map(trip => (
                  <div
                    key={trip.id}
                    className="folder-card home-trip-card"
                    onClick={() => openTrip(trip.id)}
                    style={trip.background ? { backgroundImage: trip.background, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
                  >
                    <div className="folder-content" style={trip.background ? { textShadow: '0 2px 4px rgba(0,0,0,0.8)' } : {}}>
                      <div className="home-trip-top">
                        <span className="folder-icon" style={trip.background ? { filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' } : {}}>{tripEmojiMap[trip.id] || '🧳'}</span>
                        <div className="home-trip-actions">
                          <button className="delete-btn" onClick={(e) => { e.stopPropagation(); setShowBgPicker(showBgPicker === trip.id ? null : trip.id); }} title="Change cover">✏️</button>
                          {isTripManager(trip) && (
                            <button className="delete-btn" onClick={(e) => deleteFolder(e, trip.id)} title="Delete trip">✕</button>
                          )}
                        </div>
                      </div>
                      <div className="folder-info">
                        <div className="folder-name">{trip.name}</div>
                        <div className="folder-meta" style={trip.background ? { color: 'rgba(255,255,255,0.9)' } : {}}>
                          <span>{trip.expenses.length} expenses</span>
                          <span className="meta-dot">{trip.member_count || 1} members</span>
                        </div>
                        <div className="folder-date" style={trip.background ? { color: 'rgba(255,255,255,0.85)' } : {}}>
                          Updated {new Date(trip.last_updated).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {showBgPicker === trip.id && (
                      <div className="theme-picker-popup" onClick={e => e.stopPropagation()}>
                        <div style={{ marginBottom: '12px', fontWeight: 'bold', fontSize: '0.9rem' }}>Change Cover</div>
                        <div className="theme-options">
                          <div className="theme-circle" style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }} onClick={() => updateTripBackground(trip.id, 'linear-gradient(135deg, #6366f1, #a855f7)')}></div>
                          <div className="theme-circle" style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }} onClick={() => updateTripBackground(trip.id, 'linear-gradient(135deg, #ec4899, #8b5cf6)')}></div>
                          <div className="theme-circle" style={{ background: 'linear-gradient(135deg, #10b981, #3b82f6)' }} onClick={() => updateTripBackground(trip.id, 'linear-gradient(135deg, #10b981, #3b82f6)')}></div>
                          <div className="theme-circle" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }} onClick={() => updateTripBackground(trip.id, 'linear-gradient(135deg, #f59e0b, #ef4444)')}></div>
                          <div className="theme-circle" style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }} onClick={() => updateTripBackground(trip.id, 'linear-gradient(135deg, #06b6d4, #3b82f6)')}></div>
                          <div className="theme-circle" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #555' }} onClick={() => updateTripBackground(trip.id, '')}></div>
                        </div>

                        <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <input placeholder="Paste Image URL..." style={{ fontSize: '0.9rem', padding: '8px' }} value={customImageUrl} onChange={e => setCustomImageUrl(e.target.value)} />
                          <button className="btn btn-primary" style={{ padding: '8px', fontSize: '0.9rem', width: '100%' }} onClick={() => updateTripBackground(trip.id, `url(${customImageUrl})`)}>Use URL</button>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px' }}>
                            <div style={{ height: '1px', background: 'rgba(255,255,255,0.2)', flex: 1 }}></div>
                            <span style={{ fontSize: '0.7rem', color: '#888' }}>OR</span>
                            <div style={{ height: '1px', background: 'rgba(255,255,255,0.2)', flex: 1 }}></div>
                          </div>

                          <input type="file" accept="image/*" style={{ display: 'none' }} ref={fileInputRef} onChange={(e) => handleFileUpload(e, trip.id)} />
                          <button className="upload-btn" onClick={() => fileInputRef.current.click()}>📲 Upload from Device</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- VIEW 2: TRIP OVERVIEW ---------------- */}
      {view === 'trip_view' && activeTrip && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isEditingTitle ? (
                <input
                  className="header-title-input"
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  onBlur={handleSaveTripName}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveTripName()}
                  autoFocus
                />
              ) : (
                <h1 className="header-title" onClick={() => { setIsEditingTitle(true); setTempTitle(activeTrip.name); }}>
                  {activeTrip.name} <span style={{ fontSize: '1rem', opacity: 0.5, marginLeft: '10px', cursor: 'pointer', verticalAlign: 'middle' }}>✎</span>
                </h1>
              )}
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', padding: '6px 12px',
              borderRadius: '12px', width: 'fit-content', fontSize: '0.85rem', color: 'var(--primary-glow)', display: 'flex', gap: '8px', alignItems: 'center'
            }}>
              <span style={{ opacity: 0.7 }}>Invite Code:</span>
              <strong style={{ letterSpacing: '1px', color: 'white' }}>{activeTrip.id || '------'}</strong>
              <span style={{ cursor: 'pointer', marginLeft: '5px' }} onClick={() => navigator.clipboard.writeText(activeTrip.id)} title="Copy Code">📋</span>
            </div>
          </div>

          <div className="layout-grid">
            {/* LEFT: RECEIPT TABS */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h2 style={{ margin: 0 }}>Receipts</h2>
                <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={openReceiptBuilder}>+ Add New</button>
              </div>
              {tripLocations.length === 0 && <div style={{ color: 'var(--text-muted)', padding: '20px', border: '1px dashed var(--glass-border)', borderRadius: '10px' }}>No receipts yet.</div>}
              <div className="folder-grid" style={{ justifyContent: 'flex-start' }}>
                {tripLocations.map(loc => {
                  const locTheme = activeTrip.themes?.[loc];
                  const tileStyle = locTheme ? { backgroundImage: locTheme, backgroundSize: 'cover', backgroundPosition: 'center' } : {};
                  return (
                    <div key={loc} className="folder-card" style={{ padding: '20px', ...tileStyle }} onClick={() => openLocationTab(loc)}>
                      <span style={{ fontSize: '2rem', textShadow: locTheme ? '0 2px 4px rgba(0,0,0,0.5)' : 'none' }}>🧾</span>
                      <div style={{ fontWeight: 'bold', marginTop: '5px', color: 'white', textShadow: locTheme ? '0 2px 4px rgba(0,0,0,0.8)' : 'none' }}>{loc}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* RIGHT: TRIP CALCULATIONS */}
            <div>
              <div className="card">
                <h2 style={{ marginTop: 0 }}>Final Settlement</h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Calculates net debts across ALL receipts.</p>
                <button className="btn btn-primary" onClick={calculateTripSettlement} disabled={isLoading || activeTrip.expenses.length === 0}>
                  {isLoading ? 'Calculating...' : 'Calculate Who Owes Who'}
                </button>
              </div>

              {/* --- GROUPED & INTERACTIVE SETTLEMENTS UI --- */}
              {results.length > 0 && (
                <div className="card settlement-card" style={{ padding: '24px' }}>
                  <h2 style={{ marginTop: 0, color: 'var(--success)', marginBottom: '20px' }}>Final Settlements</h2>
                  <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                    {Object.entries(
                      results.reduce((acc, line) => {
                        const match = line.match(/^(.*?)\s+owes\s+(.*?)\s+\$?(\d+(?:\.\d{1,2})?)/i);
                        if (match) {
                          const debtor = match[1];
                          const creditor = match[2];
                          const amount = match[3];
                          if (!acc[creditor]) acc[creditor] = [];
                          acc[creditor].push({ debtor, amount, line });
                        } else {
                          if (!acc['Other']) acc['Other'] = [];
                          acc['Other'].push({ line });
                        }
                        return acc;
                      }, {})
                    ).map(([creditorName, debts]) => (
                      <div key={creditorName} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '16px' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--success)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', fontSize: '1.1rem' }}>
                          {creditorName === 'Other' ? 'Other' : `Owed to ${creditorName}:`}
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {debts.map((debt, idx) => {
                            const isSettled = activeTrip.settled_debts?.includes(debt.line);

                            return (
                              <div key={idx} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                opacity: isSettled ? 0.4 : 1, transition: 'opacity 0.2s'
                              }}>
                                {debt.debtor ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                                    <button
                                      onClick={() => toggleSettlement(debt.line)}
                                      title={isSettled ? "Mark as unpaid" : "Mark as paid"}
                                      style={{
                                        background: isSettled ? 'var(--success)' : 'transparent',
                                        border: '1px solid var(--success)',
                                        color: isSettled ? 'white' : 'var(--success)',
                                        borderRadius: '50%', width: '24px', height: '24px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', fontSize: '0.8rem', flexShrink: 0
                                      }}
                                    >
                                      {isSettled ? '✓' : ''}
                                    </button>
                                    <span style={{ color: 'var(--text-main)', textDecoration: isSettled ? 'line-through' : 'none' }}>
                                      {debt.debtor}
                                    </span>
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)' }}>{debt.line}</span>
                                )}

                                {debt.amount && (
                                  <span style={{ color: 'var(--success)', fontWeight: 'bold', textDecoration: isSettled ? 'line-through' : 'none' }}>
                                    +${parseFloat(debt.amount).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTrip.expenses.length > 0 && (
                <div style={{ marginTop: '30px' }}>
                  <h3 style={{ marginBottom: '15px', paddingLeft: '10px' }}>Total Trip Breakdown</h3>
                  <div className="breakdown-grid">
                    {Object.entries(getBreakdown(activeTrip.expenses)).map(([person, data]) => (
                      <div key={person} className="spreadsheet-card">
                        <div className="spreadsheet-header">{person}</div>
                        <div className="spreadsheet-body">
                          {data.items.map((i, idx) => (
                            <div key={idx} className="line-item"><span>{i.name} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({i.location})</span></span><span>{i.cost.toFixed(2)}</span></div>
                          ))}
                        </div>
                        <div className="spreadsheet-footer">
                          <div className="summary-row"><span>Subtotal</span><span>{data.subtotal.toFixed(2)}</span></div>
                          <div className="summary-row"><span>Tax</span><span>{data.tax.toFixed(2)}</span></div>
                          <div className="summary-row"><span>Tip</span><span>{data.tip.toFixed(2)}</span></div>
                          <div className="grand-total-row"><span>TOTAL</span><span>${data.grandTotal.toFixed(2)}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- VIEW 3: SINGLE RECEIPT DETAIL ---------------- */}
      {view === 'receipt_detail' && activeLocation && (
        <div className="container print-container">
          <div className="no-print">
            <button className="back-btn" onClick={() => setView('trip_view')} style={{ marginBottom: '20px' }}>← Back to Trip</button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h1 className="header-title" style={{ margin: 0 }}>{activeLocation} <span className="no-print" style={{ fontSize: '0.5em', opacity: 0.5 }}>Receipt</span></h1>
            <div className="no-print" style={{ position: 'relative' }}>
              <button className="btn-icon" style={{ width: '36px', height: '36px', fontSize: '1rem', background: 'rgba(255,255,255,0.1)' }} onClick={() => setShowBgPicker(!showBgPicker)}>🎨</button>
              {showBgPicker && (
                <div className="theme-picker-popup">
                  <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '0.8rem' }}>Change Card Background</div>
                  <div className="theme-options">
                    <div className="theme-circle" style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }} onClick={() => updateReceiptTheme('linear-gradient(135deg, #6366f1, #a855f7)')}></div>
                    <div className="theme-circle" style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }} onClick={() => updateReceiptTheme('linear-gradient(135deg, #ec4899, #8b5cf6)')}></div>
                    <div className="theme-circle" style={{ background: 'linear-gradient(135deg, #10b981, #3b82f6)' }} onClick={() => updateReceiptTheme('linear-gradient(135deg, #10b981, #3b82f6)')}></div>
                    <div className="theme-circle" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }} onClick={() => updateReceiptTheme('linear-gradient(135deg, #f59e0b, #ef4444)')}></div>
                    <div className="theme-circle" style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }} onClick={() => updateReceiptTheme('linear-gradient(135deg, #06b6d4, #3b82f6)')}></div>
                    <div className="theme-circle" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #555' }} onClick={() => updateReceiptTheme('')}></div>
                  </div>
                  <div style={{ marginTop: '10px', display: 'flex', gap: '5px' }}>
                    <input placeholder="Image URL..." style={{ fontSize: '0.8rem', padding: '6px' }} value={customImageUrl} onChange={e => setCustomImageUrl(e.target.value)} />
                    <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.8rem', width: 'auto' }} onClick={() => updateReceiptTheme(`url(${customImageUrl})`)}>Go</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="action-bar no-print">
            <button className="btn-action btn-edit" onClick={() => loadReceiptBatch(activeLocation)}><span>✎</span> Edit / Add Items</button>
            <button className="btn-action btn-pdf" onClick={printReceipt}><span>📄</span> Save as PDF</button>
            <label className="btn-action btn-upload">
              <span>📷</span> Upload Photo
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleReceiptImageUpload(e, activeLocation)} />
            </label>
          </div>

          {activeTrip.receipt_images && activeTrip.receipt_images[activeLocation] && (
            <div style={{ marginBottom: '20px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--glass-border)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
              <img src={activeTrip.receipt_images[activeLocation]} alt="Receipt" style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', background: 'rgba(0,0,0,0.2)', display: 'block' }} />
            </div>
          )}

          <div className="layout-grid">
            <div className="card" style={activeReceiptTheme ? { backgroundImage: activeReceiptTheme, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' } : {}}>
              <h3 style={{ marginTop: 0, textShadow: activeReceiptTheme ? '0 2px 4px rgba(0,0,0,0.8)' : 'none' }}>Receipt Items</h3>
              <div className="items-grid">
                {locationExpenses.map(exp => (
                  <div key={exp.id} className="expense-box" style={activeReceiptTheme ? { background: 'rgba(0,0,0,0.6)', borderColor: 'rgba(255,255,255,0.2)' } : {}}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'white' }}>{exp.item}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Shared by: <span style={{ color: 'white' }}>{exp.involved.join(', ')}</span></div>
                      <div style={{ fontSize: '0.8rem', color: activeReceiptTheme ? '#818cf8' : 'var(--primary-glow)', marginTop: '4px', fontWeight: activeReceiptTheme ? 'bold' : 'normal' }}>
                        Paid by: {exp.payer}
                      </div>
                    </div>
                    <div className="expense-box-footer" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <span style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '1.1rem' }}>${exp.amount.toFixed(2)}</span>
                      <div className="no-print" style={{ display: 'flex', gap: '10px' }}>
                        <span style={{ cursor: 'pointer', fontSize: '1.2rem' }} onClick={() => editSavedExpense(exp)}>✎</span>
                        <span style={{ cursor: 'pointer', fontSize: '1.2rem', color: 'var(--danger)' }} onClick={() => deleteExpense(exp.id)}>✕</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 style={{ marginTop: 0, marginBottom: '15px', paddingLeft: '10px' }}>Split Breakdown</h3>
              <div className="breakdown-grid">
                {Object.entries(getBreakdown(locationExpenses)).map(([person, data]) => (
                  <div key={person} className="spreadsheet-card">
                    <div className="spreadsheet-header">{person}</div>
                    <div className="spreadsheet-body">
                      {data.items.map((i, idx) => (
                        <div key={idx} className="line-item"><span>{i.name}</span><span>{i.cost.toFixed(2)}</span></div>
                      ))}
                    </div>
                    <div className="spreadsheet-footer">
                      <div className="summary-row"><span>Subtotal</span><span>{data.subtotal.toFixed(2)}</span></div>
                      <div className="summary-row"><span>Tax</span><span>{data.tax.toFixed(2)}</span></div>
                      <div className="summary-row"><span>Tip</span><span>{data.tip.toFixed(2)}</span></div>
                      <div className="grand-total-row"><span>TOTAL</span><span>${data.grandTotal.toFixed(2)}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- VIEW 4: EDITOR ---------------- */}
      {view === 'receipt_editor' && (
        <div className="container">
          <button className="back-btn" onClick={() => setView('trip_view')} style={{ marginBottom: '20px' }}>Cancel</button>
          <div className="card">
            <h2 style={{ marginTop: 0, color: 'var(--primary)' }}>
              {editingLocationBatch
                ? `Editing Receipt: ${editingLocationBatch}`
                : (editingTripExpenseId ? `Edit Item in ${receiptLoc}` : "New Receipt")}
            </h2>

            <div className="input-row" style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
              <div className="input-group" style={{ flex: 1 }}><label>Location</label><input placeholder="e.g. Cowfish" value={receiptLoc} onChange={e => setReceiptLoc(e.target.value)} /></div>
              <div className="input-group" style={{ flex: 1 }}><label>Payer</label><input placeholder="e.g. Ashton" value={receiptPayer} onChange={e => setReceiptPayer(e.target.value)} /></div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '16px', marginBottom: '20px', border: editingIndex !== null ? '1px solid var(--success)' : '1px solid var(--glass-border)' }}>
              <div className="input-row" style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 0.8 }}><label style={{ fontSize: '0.7rem' }}>Qty</label><input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} style={{ textAlign: 'center' }} /></div>
                <div style={{ flex: 2 }}><label style={{ fontSize: '0.7rem' }}>Item</label><input placeholder="Item Name" value={itemName} onChange={e => setItemName(e.target.value)} /></div>
                <div style={{ flex: 1.2 }}><label style={{ fontSize: '0.7rem' }}>Price</label><input type="number" placeholder="0.00" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} /></div>
              </div>

              <div className="input-group" style={{ marginTop: '15px' }}>
                <label style={{ fontSize: '0.7rem', marginBottom: '10px' }}>Consumers (Select who to charge)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  {allAvailablePeople.map(person => {
                    const isSelected = selectedConsumers.includes(person);
                    const isNewAddition = sessionPeople.includes(person); // Check if this is a newly added name

                    return (
                      <div
                        key={person}
                        onClick={() => toggleConsumer(person)}
                        onMouseEnter={() => setHoveredChip(person)}
                        onMouseLeave={() => setHoveredChip(null)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '8px 14px', borderRadius: '20px',
                          border: isSelected ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                          background: isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                          color: isSelected ? '#ffffff' : 'var(--text-main)',
                          cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', transition: 'all 0.2s', userSelect: 'none'
                        }}
                      >
                        {person}

                        {/* ONLY show the X if it's hovered AND it's a newly added name */}
                        {isNewAddition && hoveredChip === person && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation(); // Prevents the chip from toggling when clicking the X
                              setSessionPeople(sessionPeople.filter(n => n !== person));
                              setSelectedConsumers(selectedConsumers.filter(n => n !== person));
                              setHoveredChip(null);
                            }}
                            style={{
                              background: 'rgba(0,0,0,0.3)',
                              borderRadius: '50%',
                              width: '18px', height: '18px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.65rem', color: '#fff'
                            }}
                            title="Remove typo"
                          >
                            ✕
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    placeholder="Type a new name..." value={newPersonName}
                    onChange={e => setNewPersonName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddNewPerson(e); } }}
                    style={{ padding: '10px', fontSize: '0.9rem' }}
                  />
                  <button className="btn btn-primary" style={{ padding: '10px 16px', width: 'auto', fontSize: '0.9rem', borderRadius: '8px' }} onClick={handleAddNewPerson}>Add</button>
                </div>
              </div>

              <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                <button className="btn btn-primary" style={{ padding: '12px', fontSize: '0.9rem', background: editingIndex !== null ? 'var(--success)' : '', width: 'auto' }} onClick={handleAddOrUpdateItem}>
                  {editingIndex !== null ? 'Update Item' : '+ Add Item'}
                </button>
              </div>
            </div>

            {currentItems.length > 0 && (
              <ul style={{ paddingLeft: 0, listStyle: 'none', marginBottom: '20px' }}>
                {currentItems.map((item, idx) => (
                  <li key={idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', marginBottom: '8px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 'bold' }}>{item.qty}x {item.name}</span> <span style={{ color: 'var(--text-muted)' }}>(${item.totalPrice.toFixed(2)})</span>
                      <div style={{ fontSize: '0.75rem', color: 'var(--primary-glow)' }}>{item.consumers.join(', ')}</div>
                    </div>
                    <div style={{ cursor: 'pointer', padding: '5px' }} onClick={() => startEditingDraftItem(idx)}>✎</div>
                  </li>
                ))}
              </ul>
            )}

            <div className="input-row" style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
              <div className="input-group" style={{ flex: 1 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}><label>Tax</label><span onClick={() => setTaxMode(taxMode === '$' ? '%' : '$')} style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 'bold' }}>{taxMode}</span></div><input type="number" value={receiptTax} onChange={e => setReceiptTax(e.target.value)} /></div>
              <div className="input-group" style={{ flex: 1 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}><label>Tip</label><span onClick={() => setTipMode(tipMode === '$' ? '%' : '$')} style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 'bold' }}>{tipMode}</span></div><input type="number" value={receiptTip} onChange={e => setReceiptTip(e.target.value)} /></div>
            </div>
            <button className="btn btn-primary" style={{ marginTop: '30px' }} onClick={saveReceiptToTrip}>{editingTripExpenseId || editingLocationBatch ? "Save Changes" : "Save Receipt"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App