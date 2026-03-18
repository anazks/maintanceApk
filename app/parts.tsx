import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { getDB } from '../database';

interface SparePart {
  id: number;
  part_number: string;
  name: string;
  category: string;
  stock_quantity: number;
  minimum_quantity: number;
  location: string;
  keeper_name: string;
  unit_price: number;
  supplier: string;
  date_added: string;
}

export default function SpareParts() {
  const router = useRouter();
  const { theme, isDarkMode } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [parts, setParts] = useState<SparePart[]>([]);

  // Usage Modal State
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [selectedPart, setSelectedPart] = useState<SparePart | null>(null);
  const [useQuantity, setUseQuantity] = useState('1');
  const [useMaintainer, setUseMaintainer] = useState('');
  const [adjustmentMode, setAdjustmentMode] = useState<'withdraw' | 'restock'>('withdraw');

  // Add Part Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPartNumber, setNewPartNumber] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newMinQuantity, setNewMinQuantity] = useState('5');
  const [newLocation, setNewLocation] = useState('');
  const [newKeeperName, setNewKeeperName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newDateAdded, setNewDateAdded] = useState(new Date().toISOString().split('T')[0]);
  const [newEquipmentId, setNewEquipmentId] = useState<number | null>(null);

  // Category & Equipment State
  const [categories, setCategories] = useState<{ id: number, name: string }[]>([]);
  const [equipments, setEquipments] = useState<{ id: number, name: string }[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);

  useEffect(() => {
    loadParts();
    loadCategories();
    loadEquipments();
  }, []);

  const loadEquipments = () => {
    const db = getDB();
    try {
      const dbEqs = db.getAllSync<{ id: number, name: string }>('SELECT id, name FROM Equipment ORDER BY name');
      setEquipments(dbEqs);
    } catch (e) { console.error(e); }
  };

  const loadCategories = () => {
    const db = getDB();
    try {
      const dbCats = db.getAllSync<{ id: number, name: string }>('SELECT * FROM Spare_Categories ORDER BY name');
      setCategories(dbCats);
    } catch (e) { console.error(e); }
  };

  const loadParts = () => {
    const db = getDB();
    try {
      const dbParts = db.getAllSync<any>('SELECT * FROM Spare_Parts');
      const mappedParts: SparePart[] = dbParts.map(p => ({
        id: p.id,
        part_number: p.part_number,
        name: p.name,
        category: p.category || 'Uncategorized',
        stock_quantity: p.available_quantity || 0,
        minimum_quantity: p.minimum_quantity || 5,
        location: p.location || 'N/A',
        keeper_name: p.keeper_name || 'Unassigned',
        unit_price: parseFloat(p.price || '0') || 0,
        supplier: 'Unknown',
        date_added: p.date_added ? p.date_added.split(' ')[0] : 'N/A'
      }));
      setParts(mappedParts);
    } catch (e) {
      console.error(e);
    }
  };

  const getStockStatus = (stock: number) => {
    if (stock <= 0) return 'Out of Stock';
    if (stock <= 5) return 'Low Stock';
    return 'In Stock';
  };

  const filteredParts = parts.filter(part =>
    part.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    part.part_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const deficientParts = parts.filter(part => part.stock_quantity <= part.minimum_quantity).length;

  const getStockColor = (status: string) => {
    switch (status) {
      case 'In Stock': return '#10B981';
      case 'Low Stock': return '#F59E0B';
      case 'Out of Stock': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStockBgColor = (status: string) => {
    switch (status) {
      case 'In Stock': return '#D1FAE5';
      case 'Low Stock': return '#FEF3C7';
      case 'Out of Stock': return '#FEE2E2';
      default: return '#F3F4F6';
    }
  };

  const handleUpdateStock = () => {
    if (!selectedPart) return;
    const qty = parseInt(useQuantity, 10);

    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid', 'Please enter a valid quantity');
      return;
    }

    if (adjustmentMode === 'withdraw' && qty > selectedPart.stock_quantity) {
      Alert.alert('Insufficient Stock', `You only have ${selectedPart.stock_quantity} available.`);
      return;
    }

    if (!useMaintainer.trim()) {
      Alert.alert('Required', 'Please enter a name or reason.');
      return;
    }

    const db = getDB();
    try {
      db.withTransactionSync(() => {
        const adjustedQty = adjustmentMode === 'withdraw' ? -qty : qty;
        const usageQty = adjustmentMode === 'withdraw' ? qty : -qty; // Usage records typically track "used", so restock is negative used

        // Record usage/adjustment
        db.runSync(
          'INSERT INTO Spare_Usage (spare_id, equipment_id, quantity_used, maintainer_name, used_date) VALUES (?, NULL, ?, ?, datetime("now"))',
          [selectedPart.id, usageQty, useMaintainer.trim()]
        );

        // Update quantity
        db.runSync(
          'UPDATE Spare_Parts SET available_quantity = available_quantity + ? WHERE id = ?',
          [adjustedQty, selectedPart.id]
        );
      });
      loadParts();
      setShowUsageModal(false);
      setUseQuantity('1');
      setUseMaintainer('');
      setAdjustmentMode('withdraw');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', `Failed to ${adjustmentMode} part`);
    }
  };

  const handleAddPart = () => {
    if (!newName || !newPartNumber) {
      Alert.alert('Validation Error', 'Name and Part Number are required.');
      return;
    }
    const db = getDB();
    try {
      const insertResult = db.runSync(`
        INSERT INTO Spare_Parts (
          name, part_number, category, available_quantity, minimum_quantity, price, location, keeper_name, date_added
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        newName,
        newPartNumber,
        newCategory || 'Uncategorized',
        parseFloat(newQuantity) || 0,
        parseFloat(newMinQuantity) || 5,
        newPrice || '0.00',
        newLocation || 'N/A',
        newKeeperName || 'Unassigned',
        newDateAdded || new Date().toISOString().split('T')[0]
      ]);

      const spareId = insertResult.lastInsertRowId;

      if (newEquipmentId) {
        db.runSync(
          'INSERT INTO Equipment_Spares (equipment_id, spare_id, linked_by) VALUES (?, ?, ?)',
          [newEquipmentId, spareId, newKeeperName || 'Admin']
        );

        // If initial quantity was provided, maybe record it as setup use? 
        // Or just link it. Usually "Add Part" is inventory.
        // But if they select equipment, it implies it's for that equipment.
      }

      // Reset Form State
      setNewName(''); setNewPartNumber(''); setNewCategory('');
      setNewQuantity(''); setNewMinQuantity('5'); setNewLocation(''); setNewKeeperName(''); setNewPrice('');
      setNewDateAdded(new Date().toISOString().split('T')[0]);
      setNewEquipmentId(null);
      setShowAddModal(false);
      loadParts();
    } catch (e: any) {
      console.error(e);
      if (e.message?.includes('UNIQUE')) {
        Alert.alert('Duplicate', 'A part with this Part Number already exists.');
      } else {
        Alert.alert('Error', 'Failed to add spare part.');
      }
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.surface }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.surface} />

      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderWidth: 1 }]}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={[styles.brandTitle, { color: theme.colors.primary }]}>SUJATA Spares</Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>Inventory & Stock Control</Text>
          </View>
          <TouchableOpacity style={[styles.addButtonSmall, { backgroundColor: theme.dark ? '#1E3A8A' : '#EFF6FF' }]} onPress={() => setShowAddModal(true)}>
            <Ionicons name="add" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Global Stock Alert Banner */}
        {deficientParts > 0 && (
          <View style={[styles.alertBanner, { backgroundColor: theme.dark ? '#450a0a' : '#FEE2E2', borderBottomColor: theme.dark ? '#7f1d1d' : '#FCA5A5' }]}>
            <Ionicons name="warning" size={20} color={theme.dark ? '#f87171' : '#991B1B'} />
            <Text style={[styles.alertText, { color: theme.dark ? '#fecaca' : '#991B1B' }]}>
              <Text style={{ fontWeight: '700' }}>{deficientParts} parts</Text> require restocking.
            </Text>
          </View>
        )}

        {/* Search */}
        <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.searchBar, { backgroundColor: theme.colors.background }]}>
            <Ionicons name="search-outline" size={20} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder="Search parts by name or ID..."
              placeholderTextColor={theme.colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Parts List */}
        <FlatList
          data={filteredParts}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: '#6B7280' }}>No parts matching search.</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const status = getStockStatus(item.stock_quantity);
            const isLowStock = item.stock_quantity <= item.minimum_quantity;

            return (
              <TouchableOpacity
                style={[
                  styles.card,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  isLowStock && { backgroundColor: theme.dark ? '#450a0a' : '#FEF2F2', borderColor: theme.dark ? '#7f1d1d' : '#FCA5A5' }
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  setSelectedPart(item);
                  setShowUsageModal(true);
                }}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.partName, { color: theme.colors.text }]} numberOfLines={1}>{item.name}</Text>
                    <View style={styles.idContainer}>
                      <Text style={[styles.partId, { color: theme.colors.textSecondary }]}>{item.part_number}</Text>
                      <Text style={[styles.dot, { color: theme.colors.textSecondary }]}>•</Text>
                      <Text style={[styles.category, { color: theme.colors.textSecondary }]}>{item.category}</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 }}>Added: {item.date_added}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStockBgColor(status) }]}>
                    <Text style={[styles.statusText, { color: getStockColor(status) }]}>
                      {item.stock_quantity} in stock
                    </Text>
                  </View>
                </View>

                <View style={[styles.cardFooter, { borderTopColor: theme.colors.border }]}>
                  <View style={styles.footerItemGrp}>
                    <View style={styles.footerItem}>
                      <Ionicons name="location-outline" size={14} color={theme.colors.textSecondary} />
                      <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>Loc: {item.location}</Text>
                    </View>
                    <View style={styles.footerItem}>
                      <Ionicons name="person-outline" size={14} color={theme.colors.textSecondary} />
                      <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>Kp: {item.keeper_name}</Text>
                    </View>
                  </View>
                  <Text style={[styles.price, { color: theme.colors.text }]}>{item.unit_price.toFixed(2)}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Usage Modal */}
      <Modal visible={showUsageModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', alignItems: 'center' }}
          >
            <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, width: '100%' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Stock Adjustment</Text>
                <TouchableOpacity onPress={() => { setShowUsageModal(false); setUseQuantity('1'); setUseMaintainer(''); setAdjustmentMode('withdraw'); }}>
                  <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {selectedPart && (
                  <Text style={[styles.modalSub, { color: theme.colors.textSecondary }]}>
                    Update inventory for <Text style={{ fontWeight: '600', color: theme.colors.text }}>{selectedPart.name}</Text>. (Current: {selectedPart.stock_quantity})
                  </Text>
                )}

                <View style={[styles.modeToggleContainer, { backgroundColor: theme.colors.background }]}>
                  <TouchableOpacity
                    style={[styles.modeTab, adjustmentMode === 'withdraw' && [styles.activeModeTab, { backgroundColor: theme.colors.surface }]]}
                    onPress={() => setAdjustmentMode('withdraw')}
                  >
                    <Text style={[styles.modeTabText, adjustmentMode === 'withdraw' && [styles.activeModeTabText, { color: theme.colors.text }]]}>Withdraw</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modeTab, adjustmentMode === 'restock' && [styles.activeModeTab, { backgroundColor: theme.colors.surface }]]}
                    onPress={() => setAdjustmentMode('restock')}
                  >
                    <Text style={[styles.modeTabText, adjustmentMode === 'restock' && [styles.activeModeTabText, { color: theme.colors.text }]]}>Restock</Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Quantity</Text>
                <View style={styles.qtyAdjustmentContainer}>
                  <TouchableOpacity
                    style={[styles.qtyBtn, { backgroundColor: theme.colors.background }]}
                    onPress={() => setUseQuantity(q => Math.max(1, parseInt(q || '0') - 1).toString())}
                  >
                    <Ionicons name="remove" size={24} color={theme.colors.text} />
                  </TouchableOpacity>

                  <TextInput
                    style={[styles.qtyInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                    value={useQuantity}
                    onChangeText={setUseQuantity}
                    keyboardType="number-pad"
                  />

                  <TouchableOpacity
                    style={[styles.qtyBtn, { backgroundColor: theme.colors.background }]}
                    onPress={() => setUseQuantity(q => (parseInt(q || '0') + 1).toString())}
                  >
                    <Ionicons name="add" size={24} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Maintainer / Reason</Text>
                <TextInput
                  style={[styles.modalInputFlat, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder={adjustmentMode === 'withdraw' ? "Maintainer Name" : "Restock Reason/Name"}
                  placeholderTextColor={theme.colors.textSecondary}
                  value={useMaintainer}
                  onChangeText={setUseMaintainer}
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.modalBtnSubmit, { backgroundColor: adjustmentMode === 'withdraw' ? '#EF4444' : '#10B981' }]} onPress={handleUpdateStock}>
                    <Text style={styles.modalBtnSubmitText}>
                      {adjustmentMode === 'withdraw' ? 'Confirm Withdrawal' : 'Confirm Restock'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Add New Part Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', alignItems: 'center' }}
          >
            <View style={[styles.modalContent, { maxHeight: '90%', backgroundColor: theme.colors.surface, width: '100%' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Register New Part</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Part Name *</Text>
                <TextInput style={[styles.modalInputFlat, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]} placeholder="e.g. O-Ring Seal" placeholderTextColor={theme.colors.textSecondary} value={newName} onChangeText={setNewName} />

                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Part Number (SKU) *</Text>
                <TextInput style={[styles.modalInputFlat, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]} placeholder="e.g. PN-12345" placeholderTextColor={theme.colors.textSecondary} value={newPartNumber} onChangeText={setNewPartNumber} />

                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Category</Text>
                <TouchableOpacity
                  style={[styles.dropdownButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                  onPress={() => setShowCategoryModal(true)}
                >
                  <Text style={[newCategory ? styles.dropdownButtonTextValue : styles.dropdownButtonTextPlaceholder, { color: newCategory ? theme.colors.text : theme.colors.textSecondary }]}>
                    {newCategory || 'Uncategorized (Tap to select)'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>

                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Assign to Equipment (Optional)</Text>
                <TouchableOpacity
                  style={[styles.dropdownButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                  onPress={() => setShowEquipmentModal(true)}
                >
                  <Text style={[newEquipmentId ? styles.dropdownButtonTextValue : styles.dropdownButtonTextPlaceholder, { color: newEquipmentId ? theme.colors.text : theme.colors.textSecondary }]}>
                    {newEquipmentId ? equipments.find(e => e.id === newEquipmentId)?.name : 'Select Equipment (Tap to select)'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Initial Stock</Text>
                    <TextInput style={[styles.modalInputFlat, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]} keyboardType="number-pad" placeholder="0" value={newQuantity} onChangeText={setNewQuantity} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Minimum Threshold</Text>
                    <TextInput style={[styles.modalInputFlat, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]} keyboardType="number-pad" placeholder="5" value={newMinQuantity} onChangeText={setNewMinQuantity} />
                  </View>
                </View>

                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Storage Location</Text>
                <TextInput style={[styles.modalInputFlat, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]} placeholder="e.g. Aisle 4, Bin B" placeholderTextColor={theme.colors.textSecondary} value={newLocation} onChangeText={setNewLocation} />

                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Keeper Name</Text>
                <TextInput style={[styles.modalInputFlat, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]} placeholder="e.g. John Doe" placeholderTextColor={theme.colors.textSecondary} value={newKeeperName} onChangeText={setNewKeeperName} />

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Unit Price</Text>
                    <TextInput style={[styles.modalInputFlat, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]} keyboardType="decimal-pad" placeholder="0.00" value={newPrice} onChangeText={setNewPrice} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Date Added</Text>
                    <TextInput style={[styles.modalInputFlat, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.textSecondary} value={newDateAdded} onChangeText={setNewDateAdded} />
                  </View>
                </View>
              </ScrollView>

              <View style={[styles.modalActions, { marginTop: 12 }]}>
                <TouchableOpacity style={styles.modalBtnSubmit} onPress={handleAddPart}>
                  <Text style={styles.modalBtnSubmitText}>Save Part Registry</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Category Selection Modal */}
      <Modal visible={showCategoryModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '60%', padding: 0 }]}>
            <View style={[styles.modalHeader, { padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', marginBottom: 0 }]}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={styles.categoryOption}
                onPress={() => { setNewCategory(''); setShowCategoryModal(false); }}
              >
                <Text style={styles.categoryOptionText}>Uncategorized</Text>
                {!newCategory && <Ionicons name="checkmark-circle" size={20} color="#2563EB" />}
              </TouchableOpacity>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.categoryOption}
                  onPress={() => { setNewCategory(cat.name); setShowCategoryModal(false); }}
                >
                  <Text style={[styles.categoryOptionText, newCategory === cat.name && { color: '#2563EB' }]}>{cat.name}</Text>
                  {newCategory === cat.name && <Ionicons name="checkmark-circle" size={20} color="#2563EB" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Equipment Selection Modal */}
      <Modal visible={showEquipmentModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '60%', padding: 0 }]}>
            <View style={[styles.modalHeader, { padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', marginBottom: 0 }]}>
              <Text style={styles.modalTitle}>Select Equipment</Text>
              <TouchableOpacity onPress={() => setShowEquipmentModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={styles.categoryOption}
                onPress={() => { setNewEquipmentId(null); setShowEquipmentModal(false); }}
              >
                <Text style={styles.categoryOptionText}>None (Inventory Only)</Text>
                {!newEquipmentId && <Ionicons name="checkmark-circle" size={20} color="#2563EB" />}
              </TouchableOpacity>
              {equipments.map(eq => (
                <TouchableOpacity
                  key={eq.id}
                  style={styles.categoryOption}
                  onPress={() => { setNewEquipmentId(eq.id); setShowEquipmentModal(false); }}
                >
                  <Text style={[styles.categoryOptionText, newEquipmentId === eq.id && { color: '#2563EB' }]}>{eq.name}</Text>
                  {newEquipmentId === eq.id && <Ionicons name="checkmark-circle" size={20} color="#2563EB" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  addButtonSmall: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
  },
  alertBanner: { backgroundColor: '#FEE2E2', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: '#FCA5A5' },
  alertText: { fontSize: 13, color: '#991B1B' },
  searchContainer: { paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#FFFFFF' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6',
    borderRadius: 8, paddingHorizontal: 10, height: 36,
  },
  searchInput: { flex: 1, marginLeft: 6, fontSize: 13, color: '#111827' },
  listContainer: { padding: 16, paddingBottom: 30, gap: 12 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  partName: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4, paddingRight: 10 },
  idContainer: { flexDirection: 'row', alignItems: 'center' },
  partId: { fontSize: 13, color: '#6B7280', fontFamily: 'monospace' },
  dot: { fontSize: 12, color: '#9CA3AF', marginHorizontal: 6 },
  category: { fontSize: 13, color: '#6B7280' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '600' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  footerItemGrp: { flexDirection: 'column', gap: 4 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerText: { fontSize: 12, color: '#6B7280' },
  price: { fontSize: 15, fontWeight: '600', color: '#111827' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalSub: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  modalInput: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 15, color: '#111827', marginBottom: 24 },
  modalInputFlat: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 15, color: '#111827', marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#4B5563', marginBottom: 6, marginLeft: 2 },
  dropdownButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, marginBottom: 16 },
  dropdownButtonTextValue: { fontSize: 15, color: '#111827' },
  dropdownButtonTextPlaceholder: { fontSize: 15, color: '#9CA3AF' },
  categoryOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  categoryOptionText: { fontSize: 15, fontWeight: '500', color: '#111827' },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtnCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  modalBtnCancelText: { fontSize: 15, fontWeight: '600', color: '#4B5563' },
  modalBtnSubmit: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center' },
  modalBtnSubmitText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },

  modeToggleContainer: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 4, marginBottom: 20 },
  modeTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  activeModeTab: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  modeTabText: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  activeModeTabText: { color: '#111827', fontWeight: '600' },

  qtyAdjustmentContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  qtyBtn: { width: 48, height: 48, backgroundColor: '#F3F4F6', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  qtyInput: { flex: 1, height: 48, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, textAlign: 'center', fontSize: 18, fontWeight: '600', color: '#111827' },
});
