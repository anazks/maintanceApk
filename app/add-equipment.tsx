import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import React, { useRef, useState } from 'react';

// Safely attempt to require ViewShot
let ViewShot: any = null;
try {
  ViewShot = require('react-native-view-shot').default;
} catch (e) {
  console.warn('ViewShot native module not found, using fallbacks.');
}
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
  const viewShotRef = useRef<any>(null);
  
  const [vessels, setVessels] = useState<{id: number, name: string, type: string}[]>([]);
  const [selectedVessels, setSelectedVessels] = useState<number[]>([]);
  const [customStatus, setCustomStatus] = useState('');

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

  React.useEffect(() => {
    loadVessels();
  }, []);

  const loadVessels = () => {
    const db = getDB();
    try {
      const dbVessels = db.getAllSync<{id: number, name: string, type: string}>('SELECT * FROM Vessels ORDER BY name');
      setVessels(dbVessels);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleVessel = (id: number) => {
    setSelectedVessels(prev => 
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.equipment_id.trim()) newErrors.equipment_id = 'Equipment ID required';
    if (!formData.name.trim()) newErrors.name = 'Equipment name required';
    if (selectedVessels.length === 0) newErrors.vessels = 'At least one vessel must be selected';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Required Fields', 'Please fill Equipment ID, Name and select at least one Vessel.');
      return;
    }
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
            formData.installation_date, 
            formData.status === 'Custom...' ? customStatus : formData.status
          ]
        );
        
        const newEquipId = result.lastInsertRowId;

        // Link Vessels
        if (selectedVessels.length > 0) {
          const vesselStmt = db.prepareSync('INSERT INTO Equipment_Vessels (equipment_id, vessel_id) VALUES (?, ?)');
          selectedVessels.forEach(vId => {
            vesselStmt.executeSync([newEquipId, vId]);
          });
          vesselStmt.finalizeSync();
        }

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
    try {
      // Try using ViewShot first (requires native rebuild)
      if (viewShotRef.current && viewShotRef.current.capture) {
        const uri = await viewShotRef.current.capture();
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'Share or Save QR Code',
            UTI: 'public.png'
          });
          return;
        }
      }
    } catch (err) {
      console.warn('ViewShot failed, falling back to Print/QRCode:', err);
    }

    // Fallback: Using expo-print to generate a PDF with border and name
    if (qrRef.current) {
      qrRef.current.toDataURL(async (data: string) => {
        try {
          const html = `
            <html>
              <head>
                <style>
                  body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; }
                  .container { border: 2px solid #e2e8f0; padding: 40px; border-radius: 20px; text-align: center; background: white; }
                  .id { margin-top: 20px; font-size: 24px; font-weight: bold; font-family: monospace; }
                  .name { margin-top: 10px; font-size: 20px; color: #374151; }
                  .caption { margin-top: 15px; font-size: 14px; color: #6b7280; }
                </style>
              </head>
              <body>
                <div class="container">
                  <img src="data:image/png;base64,${data}" style="width: 300px; height: 300px;" />
                  <div class="id">${formData.equipment_id}</div>
                  <div class="name">${formData.name}</div>
                  <div class="caption">Scan this QR code using the app</div>
                </div>
              </body>
            </html>
          `;
          const { uri } = await Print.printToFileAsync({ html });
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Download QR Code' });
        } catch (printError) {
          console.error('Print fallback failed:', printError);
          // Last resort: Save just the QR image base64
          const fileUri = `${FileSystem.documentDirectory}${formData.equipment_id}_QR.png`;
          await FileSystem.writeAsStringAsync(fileUri, data, { encoding: 'base64' });
          await Sharing.shareAsync(fileUri);
        }
      });
    }
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
            <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>These fields must be filled to save</Text>

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

            {/* Vessel Selection */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                Applicable Ship/Submarine <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={[styles.statusContainer, errors.vessels && { borderColor: '#EF4444', borderWidth: 1, borderRadius: 12, padding: 8 }]}>
                {vessels.map((vessel) => (
                  <TouchableOpacity
                    key={vessel.id}
                    style={[
                      styles.statusButton,
                      { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                      selectedVessels.includes(vessel.id) && [styles.statusButtonActive, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }],
                    ]}
                    onPress={() => {
                      toggleVessel(vessel.id);
                      if (errors.vessels) setErrors(prev => ({ ...prev, vessels: '' }));
                    }}
                  >
                    <Ionicons 
                      name={vessel.type === 'Ship' ? 'boat-outline' : 'construct-outline'} 
                      size={14} 
                      color={selectedVessels.includes(vessel.id) ? '#FFF' : theme.colors.textSecondary} 
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.statusButtonText,
                        { color: theme.colors.textSecondary },
                        selectedVessels.includes(vessel.id) && styles.statusButtonTextActive,
                      ]}
                    >
                      {vessel.name}
                    </Text>
                  </TouchableOpacity>
                ))}
                {vessels.length === 0 && (
                  <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary, fontStyle: 'italic' }]}>
                    No vessels found. Add them in Settings first.
                  </Text>
                )}
              </View>
              {errors.vessels && (
                <Text style={styles.errorText}>{errors.vessels}</Text>
              )}
            </View>
          </View>

          {/* Optional Fields Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Additional Details</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>Optional - can be left blank</Text>

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
                {['Active', 'Inactive', 'Under Maintenance', 'Retired', 'Custom...'].map((status) => (
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

              {formData.status === 'Custom...' && (
                <View style={{ marginTop: 12 }}>
                  <View style={[styles.inputContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                    <Ionicons name="pencil-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: theme.colors.text }]}
                      placeholder="Enter custom status"
                      placeholderTextColor={theme.colors.textSecondary}
                      value={customStatus}
                      onChangeText={setCustomStatus}
                    />
                  </View>
                </View>
              )}
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
                          (formData.status === 'Under Maintenance' || formData.status === 'Maintenance') ? '#F59E0B' :
                            formData.status === 'Inactive' ? '#6B7280' :
                              formData.status === 'Retired' ? '#EF4444' : '#2563EB' // Blue for custom
                    }
                  ]} />
                  <Text style={[styles.previewStatus, { color: theme.colors.text }]}>
                    {formData.status === 'Custom...' ? (customStatus || 'Custom') : formData.status}
                  </Text>
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
            {ViewShot ? (
              <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }}>
                <View style={[styles.qrContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <View style={styles.qrBorder}>
                    <QRCode
                      value={formData.equipment_id}
                      size={200}
                      getRef={(c) => (qrRef.current = c)}
                      color={theme.dark ? '#FFFFFF' : '#111827'}
                      backgroundColor={theme.colors.surface}
                    />
                  </View>
                  <Text style={[styles.qrCodeId, { color: theme.colors.text }]}>{formData.equipment_id}</Text>
                  <Text style={[styles.qrCodeName, { color: theme.colors.text }]}>{formData.name}</Text>
                  <Text style={[styles.qrCaption, { color: theme.colors.textSecondary }]}>Scan this QR code using the app</Text>
                </View>
              </ViewShot>
            ) : (
              <View style={[styles.qrContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={styles.qrBorder}>
                  <QRCode
                    value={formData.equipment_id}
                    size={200}
                    getRef={(c) => (qrRef.current = c)}
                    color={theme.dark ? '#FFFFFF' : '#111827'}
                    backgroundColor={theme.colors.surface}
                  />
                </View>
                <Text style={[styles.qrCodeId, { color: theme.colors.text }]}>{formData.equipment_id}</Text>
                <Text style={[styles.qrCodeName, { color: theme.colors.text }]}>{formData.name}</Text>
                <Text style={[styles.qrCaption, { color: theme.colors.textSecondary }]}>Scan this QR code using the app</Text>
              </View>
            )}
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
    paddingTop: 32, // Further reduced
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.2,
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
  qrBorder: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  qrCodeId: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  qrCodeName: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: '#374151',
  },
  qrCaption: {
    marginTop: 8, fontSize: 13, color: '#6B7280'
  },
  downloadButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563EB', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, gap: 8, width: '100%', justifyContent: 'center'
  },
  downloadButtonText: {
    color: '#FFFFFF', fontWeight: '600', fontSize: 15
  }
});