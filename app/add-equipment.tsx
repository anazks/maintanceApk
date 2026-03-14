import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { getDB } from '../database';
import { useTheme } from '../context/ThemeContext';

export default function AddEquipment() {
  const { theme, isDarkMode } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const qrRef = useRef<any>(null);
  
  const [formData, setFormData] = useState({
    equipment_id: '',
    name: '',
    section: '',
    location: '',
    manufacturer: '',
    model_number: '',
    serial_number: '',
    installation_date: '',
    status: 'Active',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.equipment_id.trim()) newErrors.equipment_id = 'Equipment ID required';
    if (!formData.name.trim()) newErrors.name = 'Equipment name required';
    if (!formData.section.trim()) newErrors.section = 'Section required';
    if (!formData.location.trim()) newErrors.location = 'Location required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setLoading(true);

    try {
      const db = getDB();
      db.withTransactionSync(() => {
        const result = db.runSync(
          `INSERT INTO Equipment (equipment_id, name, section, location, manufacturer, model_number, serial_number, installation_date, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            formData.equipment_id, formData.name, formData.section, formData.location,
            formData.manufacturer, formData.model_number, formData.serial_number,
            formData.installation_date, formData.status
          ]
        );
        
        const newEquipId = result.lastInsertRowId;
        const routines = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'];
        const routineStmt = db.prepareSync('INSERT INTO Maintenance_Schedule (equipment_id, schedule_type) VALUES (?, ?)');
        
        routines.forEach(type => {
          routineStmt.executeSync([newEquipId, type]);
        });
        routineStmt.finalizeSync();
      });
      
      setLoading(false);
      setShowQRModal(true); // Show the QR code modal on success
    } catch (error: any) {
      setLoading(false);
      Alert.alert('Error', error.message?.includes('UNIQUE') ? 'Equipment ID already exists!' : 'Failed to add equipment.');
    }
  };

  const handleDownloadQR = async () => {
    if (!qrRef.current) return;

    qrRef.current.toDataURL(async (dataURL: string) => {
      try {
        const fileUri = `${FileSystem.documentDirectory}${formData.equipment_id}_QR.png`;
        await FileSystem.writeAsStringAsync(fileUri, dataURL, { encoding: 'base64' });
        
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'image/png',
            dialogTitle: 'Share or Save QR Code',
            UTI: 'public.png'
          });
        } else {
          Alert.alert('Error', 'Sharing is not available on this device');
        }
      } catch (err) {
        Alert.alert('Error', 'Failed to save or share QR code');
        console.error(err);
      }
    });
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.surface} />
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: theme.colors.background }]}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Add New Equipment</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.formCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {/* Required Fields Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Required Information</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>Fields marked with * are required</Text>

            {/* Equipment ID */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                Equipment ID <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }, errors.equipment_id && styles.inputError]}>
                <Ionicons name="finger-print-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  placeholder="EQP-001"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={formData.equipment_id}
                  onChangeText={(value) => updateField('equipment_id', value)}
                  autoCapitalize="characters"
                />
              </View>
              {errors.equipment_id && (
                <Text style={styles.errorText}>{errors.equipment_id}</Text>
              )}
            </View>

            {/* Equipment Name */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                Equipment Name <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }, errors.name && styles.inputError]}>
                <Ionicons name="cube-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  placeholder="Cooling Pump"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={formData.name}
                  onChangeText={(value) => updateField('name', value)}
                />
              </View>
              {errors.name && (
                <Text style={styles.errorText}>{errors.name}</Text>
              )}
            </View>

            {/* Section / System */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                Section / System <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }, errors.section && styles.inputError]}>
                <Ionicons name="layers-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  placeholder="Water Treatment"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={formData.section}
                  onChangeText={(value) => updateField('section', value)}
                />
              </View>
              {errors.section && (
                <Text style={styles.errorText}>{errors.section}</Text>
              )}
            </View>

            {/* Equipment Location */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                Equipment Location <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }, errors.location && styles.inputError]}>
                <Ionicons name="location-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  placeholder="Plant Room 2"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={formData.location}
                  onChangeText={(value) => updateField('location', value)}
                />
              </View>
              {errors.location && (
                <Text style={styles.errorText}>{errors.location}</Text>
              )}
            </View>
          </View>

          {/* Optional Fields Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Additional Details</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>Optional information</Text>

            {/* Manufacturer */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Manufacturer</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <Ionicons name="business-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  placeholder="Siemens"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={formData.manufacturer}
                  onChangeText={(value) => updateField('manufacturer', value)}
                />
              </View>
            </View>

            {/* Model Number */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Model Number</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <Ionicons name="barcode-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  placeholder="SPM-450"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={formData.model_number}
                  onChangeText={(value) => updateField('model_number', value)}
                />
              </View>
            </View>

            {/* Serial Number */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Serial Number</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <Ionicons name="qr-code-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  placeholder="SN239482"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={formData.serial_number}
                  onChangeText={(value) => updateField('serial_number', value)}
                />
              </View>
            </View>

            {/* Installation Date */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Installation Date</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <Ionicons name="calendar-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  placeholder="2023-05-20"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={formData.installation_date}
                  onChangeText={(value) => updateField('installation_date', value)}
                />
              </View>
            </View>

            {/* Operational Status */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Operational Status</Text>
              <View style={styles.statusContainer}>
                {['Active', 'Inactive', 'Under Maintenance', 'Retired'].map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusButton,
                      { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                      formData.status === status && [styles.statusButtonActive, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }],
                    ]}
                    onPress={() => updateField('status', status)}
                  >
                    <Text
                      style={[
                        styles.statusButtonText,
                        { color: theme.colors.textSecondary },
                        formData.status === status && styles.statusButtonTextActive,
                      ]}
                    >
                      {status}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Preview Card */}
          {Object.values(formData).some(val => val) && (
            <View style={[styles.previewCard, { backgroundColor: theme.dark ? '#0c4a6e' : '#F0F9FF', borderColor: theme.dark ? '#075985' : '#E0F2FE' }]}>
              <Text style={[styles.previewTitle, { color: theme.dark ? '#7dd3fc' : '#0369A1' }]}>Equipment Preview</Text>
              <View style={styles.previewContent}>
                <Text style={[styles.previewId, { color: theme.dark ? '#7dd3fc' : '#0369A1' }]}>{formData.equipment_id || 'EQP-XXX'}</Text>
                <Text style={[styles.previewName, { color: theme.colors.text }]}>{formData.name || 'Equipment Name'}</Text>
                <View style={[styles.previewBadge, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <View style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        formData.status === 'Active' ? '#10B981' :
                          formData.status === 'Under Maintenance' ? '#F59E0B' :
                            formData.status === 'Maintenance' ? '#F59E0B' :
                              formData.status === 'Inactive' ? '#6B7280' : '#EF4444'
                    }
                  ]} />
                  <Text style={[styles.previewStatus, { color: theme.colors.text }]}>{formData.status}</Text>
                </View>
                {formData.location && (
                  <Text style={[styles.previewLocation, { color: theme.dark ? '#7dd3fc' : '#0369A1' }]}>
                    <Ionicons name="location-outline" size={12} /> {formData.location}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: theme.colors.primary }, loading && [styles.submitButtonDisabled, { backgroundColor: theme.colors.border }]]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Add Equipment</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* QR Code Modal */}
      <Modal visible={showQRModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.success }]}>Equipment Added Successfully</Text>
              <TouchableOpacity onPress={() => { setShowQRModal(false); router.back(); }}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.qrContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <QRCode
                value={formData.equipment_id}
                size={200}
                getRef={(c) => (qrRef.current = c)}
                color={theme.dark ? '#FFFFFF' : '#111827'}
                backgroundColor={theme.colors.surface}
              />
              <Text style={[styles.qrCaption, { color: theme.colors.textSecondary }]}>Scan this QR code using the app</Text>
            </View>
            <TouchableOpacity style={[styles.downloadButton, { backgroundColor: theme.colors.primary }]} onPress={handleDownloadQR}>
              <Ionicons name="download-outline" size={20} color="#FFFFFF" />
              <Text style={styles.downloadButtonText}>Save QR Code to Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerRight: {
    width: 40,
  },
  scrollContent: {
    padding: 20,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  requiredStar: {
    color: '#EF4444',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingHorizontal: 12,
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
    marginLeft: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusButtonActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  statusButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4B5563',
  },
  statusButtonTextActive: {
    color: '#FFFFFF',
  },
  previewCard: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0369A1',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewContent: {
    alignItems: 'center',
  },
  previewId: {
    fontSize: 14,
    color: '#0369A1',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 4,
  },
  previewName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0C4A6E',
    marginBottom: 8,
    textAlign: 'center',
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  previewStatus: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0C4A6E',
  },
  previewLocation: {
    fontSize: 13,
    color: '#0369A1',
  },
  footer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20
  },
  modalContent: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, alignItems: 'center'
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 20
  },
  modalTitle: {
    fontSize: 16, fontWeight: '600', color: '#10B981'
  },
  qrContainer: {
    padding: 20, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#F3F4F6', alignItems: 'center', marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
  },
  qrCaption: {
    marginTop: 16, fontSize: 13, color: '#6B7280'
  },
  downloadButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563EB', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, gap: 8, width: '100%', justifyContent: 'center'
  },
  downloadButtonText: {
    color: '#FFFFFF', fontWeight: '600', fontSize: 15
  }
});