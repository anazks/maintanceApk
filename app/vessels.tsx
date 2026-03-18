import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { getDB } from '../database';
import { useTheme } from '../context/ThemeContext';

interface Vessel {
  id: number;
  name: string;
  type: string;
}

export default function VesselsScreen() {
  const router = useRouter();
  const { theme, isDarkMode } = useTheme();
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'Ship' | 'Submarine'>('Ship');
  const params = useLocalSearchParams();

  useEffect(() => {
    loadVessels();
    if (params.add === 'true') {
      setShowAddModal(true);
    }
  }, [params.add]);

  const loadVessels = () => {
    const db = getDB();
    try {
      const dbVessels = db.getAllSync<Vessel>('SELECT * FROM Vessels ORDER BY name');
      setVessels(dbVessels);
    } catch (e) {
      console.error(e);
    }
  };

  const addVessel = () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }
    const db = getDB();
    try {
      db.runSync('INSERT INTO Vessels (name, type) VALUES (?, ?)', [newName.trim(), newType]);
      setNewName('');
      setShowAddModal(false);
      loadVessels();
    } catch (e) {
      Alert.alert('Error', 'Failed to add vessel');
    }
  };

  const deleteVessel = (id: number) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this vessel?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const db = getDB();
            try {
              db.runSync('DELETE FROM Vessels WHERE id = ?', [id]);
              loadVessels();
            } catch (e) {
              Alert.alert('Error', 'Failed to delete vessel');
            }
          },
        },
      ]
    );
  };

  const renderVesselItem = ({ item }: { item: Vessel }) => (
    <View style={[styles.vesselItem, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={styles.vesselInfo}>
        <Ionicons 
          name={item.type === 'Ship' ? 'boat-outline' : 'construct-outline'} 
          size={24} 
          color={theme.colors.primary} 
        />
        <View style={styles.vesselTextContainer}>
          <Text style={[styles.vesselName, { color: theme.colors.text }]}>{item.name}</Text>
          <Text style={[styles.vesselType, { color: theme.colors.textSecondary }]}>{item.type}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={() => deleteVessel(item.id)}>
        <Ionicons name="trash-outline" size={20} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.surface }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.surface} />
      
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Manage Ships/Subm.</Text>
          <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addButton}>
            <Ionicons name="add" size={28} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={vessels}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderVesselItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="boat-outline" size={64} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No vessels added yet.</Text>
            </View>
          }
        />
      </View>

      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%', alignItems: 'center' }}
          >
            <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Add New Vessel</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }} keyboardShouldPersistTaps="handled">
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
                  placeholder="e.g. INS Vikramaditya"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={newName}
                  onChangeText={setNewName}
                />

                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Type</Text>
                <View style={styles.typeContainer}>
                  <TouchableOpacity 
                    style={[styles.typeOption, newType === 'Ship' && { backgroundColor: theme.colors.primary }]}
                    onPress={() => setNewType('Ship')}
                  >
                    <Text style={[styles.typeText, newType === 'Ship' && { color: '#FFF' }]}>Ship</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.typeOption, newType === 'Submarine' && { backgroundColor: theme.colors.primary }]}
                    onPress={() => setNewType('Submarine')}
                  >
                    <Text style={[styles.typeText, newType === 'Submarine' && { color: '#FFF' }]}>Submarine</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddModal(false)}>
                    <Text style={[styles.cancelBtnText, { color: theme.colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.submitBtn, { backgroundColor: theme.colors.primary }]} onPress={addVessel}>
                    <Text style={styles.submitBtnText}>Add Vessel</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 16, 
    paddingTop: 32, // Reduced from 45/60
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  backButton: { padding: 4 },
  addButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  listContent: { padding: 20 },
  vesselItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    padding: 16, 
    borderRadius: 12, 
    borderWidth: 1,
    marginBottom: 12,
  },
  vesselInfo: { flexDirection: 'row', alignItems: 'center' },
  vesselTextContainer: { marginLeft: 16 },
  vesselName: { fontSize: 16, fontWeight: '600' },
  vesselType: { fontSize: 14 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 16, fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    width: '100%'
  },
  modalContent: {
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '90%', // Added from instruction
    maxHeight: '90%', // Added from instruction
    shadowColor: '#000', // Added from instruction
  },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 20 },
  typeContainer: { flexDirection: 'row', gap: 12, marginBottom: 30 },
  typeOption: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  typeText: { fontSize: 16, fontWeight: '600', color: '#4B5563' },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: '600' },
  submitBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
});
