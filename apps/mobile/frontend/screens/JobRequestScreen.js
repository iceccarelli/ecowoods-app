/**
 * JobRequestScreen — v4.0  (5-step conversion funnel)
 * ─────────────────────────────────────────────────────────────────────
 * • 5-step wizard with progress bar + per-step validation
 * • Photo uploads (camera + library) via expo-image-picker
 * • Auto-saves draft to AsyncStorage — recoverable on next launch
 * • useMutation submit → goes through useStore.createJobRequest
 *     so the store's optimistic update + socket listeners stay in sync
 * • Auto-uploads photos via api.uploadPhoto when available
 * • Haptic feedback on every transition / select
 *
 * File location: frontend/screens/JobRequestScreen.js  (replace existing)
 *
 * On success → navigates to RequestEstimate for the new job id.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import useStore from '../context/useStore';
import { COLORS } from '../styles';

const SERVICES = [
  {
    key: 'installation',
    label: 'New Installation',
    icon: 'construct',
    desc: 'Install brand-new hardwood floors',
  },
  {
    key: 'refinishing',
    label: 'Refinishing',
    icon: 'color-fill',
    desc: 'Refresh existing floors',
  },
  {
    key: 'repair',
    label: 'Repair',
    icon: 'hammer',
    desc: 'Fix damaged sections',
  },
  {
    key: 'staining',
    label: 'Staining',
    icon: 'brush',
    desc: 'Change the floor color',
  },
  {
    key: 'sanding',
    label: 'Sanding',
    icon: 'cut',
    desc: 'Smooth surface restoration',
  },
];

const WOOD_TYPES = [
  { key: 'oak', label: 'Oak', icon: 'leaf' },
  { key: 'maple', label: 'Maple', icon: 'leaf' },
  { key: 'walnut', label: 'Walnut', icon: 'leaf' },
  { key: 'cherry', label: 'Cherry', icon: 'leaf' },
  { key: 'hickory', label: 'Hickory', icon: 'leaf' },
  { key: 'pine', label: 'Pine', icon: 'leaf' },
  { key: 'engineered', label: 'Engineered', icon: 'layers' },
  { key: 'bamboo', label: 'Bamboo', icon: 'leaf' },
  { key: 'other', label: 'Not Sure', icon: 'help-circle' },
];

const PROPERTY_TYPES = [
  { key: 'residential', label: 'Residential', icon: 'home' },
  { key: 'commercial', label: 'Commercial', icon: 'business' },
  { key: 'rental', label: 'Rental', icon: 'key' },
];

const TIMEFRAMES = [
  { key: 'asap', label: 'ASAP (within 1 week)' },
  { key: '2_weeks', label: 'Within 2 weeks' },
  { key: '1_month', label: 'Within 1 month' },
  { key: '3_months', label: '1–3 months' },
  { key: 'flexible', label: 'Flexible / no rush' },
];

const DRAFT_KEY = 'ecowoods-job-request-draft';
const TOTAL_STEPS = 5;

export default function JobRequestScreen({ navigation }) {
  const queryClient = useQueryClient();
  const createJobRequest = useStore((s) => s.createJobRequest);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    services: [],
    wood_type: '',
    size: '',
    property_type: '',
    address: '',
    timeframe: '',
    notes: '',
    photos: [],
  });
  const [submitting, setSubmitting] = useState(false);

  /* ── Load draft on mount ───────────────────────────────── */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(DRAFT_KEY);
        if (!stored || !mounted) return;
        const draft = JSON.parse(stored);
        const hasContent =
          draft?.services?.length ||
          draft?.wood_type ||
          draft?.notes ||
          draft?.address;
        if (hasContent) {
          Alert.alert(
            'Continue your draft?',
            "You have a saved job request. Pick up where you left off?",
            [
              {
                text: 'Discard',
                style: 'destructive',
                onPress: () =>
                  AsyncStorage.removeItem(DRAFT_KEY).catch(() => {}),
              },
              { text: 'Continue', onPress: () => mounted && setForm(draft) },
            ]
          );
        }
      } catch (e) {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  /* ── Auto-save draft on every form change ──────────────── */
  useEffect(() => {
    AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(form)).catch(() => {});
  }, [form]);

  /* ── Mutation: submit ──────────────────────────────────── */
  const submitMutation = useMutation({
    mutationFn: (data) => createJobRequest(data),
    onSuccess: (result) => {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(() => {});
      }
      AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['jobRequests'] });
      const newJobId = result?.id || result?.job_request_id;
      Alert.alert(
        'Job request submitted!',
        "We'll send you competitive bids within 24 hours.",
        [
          {
            text: 'View Estimate',
            onPress: () => {
              if (newJobId) {
                navigation.replace('RequestEstimate', { jobId: newJobId });
              } else {
                navigation.goBack();
              }
            },
          },
        ]
      );
    },
    onError: (err) => {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error
        ).catch(() => {});
      }
      Alert.alert('Submission failed', err?.message || 'Please try again.');
    },
  });

  /* ── Helpers ───────────────────────────────────────────── */
  const update = useCallback((patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleService = useCallback((key) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setForm((prev) => {
      const exists = prev.services.includes(key);
      return {
        ...prev,
        services: exists
          ? prev.services.filter((s) => s !== key)
          : [...prev.services, key],
      };
    });
  }, []);

  const pickImage = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permission needed',
          'Please allow photo access to attach images.'
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.7,
        selectionLimit: 5,
      });
      if (!result.canceled && result.assets?.length) {
        setForm((prev) => ({
          ...prev,
          photos: [
            ...prev.photos,
            ...result.assets.map((a) => a.uri),
          ].slice(0, 5),
        }));
        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
      }
    } catch (e) {}
  }, []);

  const takePhoto = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow camera access.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.length) {
        setForm((prev) => ({
          ...prev,
          photos: [...prev.photos, result.assets[0].uri].slice(0, 5),
        }));
        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
      }
    } catch (e) {}
  }, []);

  const removePhoto = useCallback((idx) => {
    setForm((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== idx),
    }));
  }, []);

  /* ── Per-step validation ───────────────────────────────── */
  const stepValid = useMemo(() => {
    switch (step) {
      case 1:
        return form.services.length > 0;
      case 2:
        return !!form.wood_type;
      case 3:
        return !!form.size && !!form.property_type;
      case 4:
        return !!form.address && !!form.timeframe;
      case 5:
        return true; // notes + photos optional
      default:
        return false;
    }
  }, [step, form]);

  /* ── Step navigation ───────────────────────────────────── */
  const goNext = useCallback(() => {
    if (!stepValid) {
      Alert.alert('Almost there', 'Please complete the required fields.');
      return;
    }
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  }, [stepValid, step]);

  const goBack = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    if (step > 1) setStep(step - 1);
    else navigation.goBack();
  }, [step, navigation]);

  /* ── Submit ────────────────────────────────────────────── */
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Upload photos first if API supports it; otherwise pass local URIs through
      let photoUrls = form.photos;
      if (form.photos.length > 0 && typeof api.uploadPhoto === 'function') {
        try {
          photoUrls = await Promise.all(
            form.photos.map((uri) => api.uploadPhoto(uri))
          );
        } catch (e) {
          // If uploads fail, submit without photos so the user isn't blocked
          photoUrls = [];
        }
      }

      const payload = {
        services: form.services,
        wood_type: form.wood_type,
        size: form.size ? parseFloat(form.size) : null,
        property_type: form.property_type,
        address: form.address,
        timeframe: form.timeframe,
        notes: form.notes || null,
        photos: photoUrls,
      };
      await submitMutation.mutateAsync(payload);
    } catch (e) {
      // handled by onError
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Render ────────────────────────────────────────────── */
  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {/* Progress */}
      <View style={s.progressBar}>
        <View
          style={[s.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]}
        />
      </View>
      <View style={s.progressLabel}>
        <Text style={s.progressText}>
          Step {step} of {TOTAL_STEPS}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 1 && <Step1 form={form} toggleService={toggleService} />}
        {step === 2 && <Step2 form={form} update={update} />}
        {step === 3 && <Step3 form={form} update={update} />}
        {step === 4 && <Step4 form={form} update={update} />}
        {step === 5 && (
          <Step5
            form={form}
            update={update}
            pickImage={pickImage}
            takePhoto={takePhoto}
            removePhoto={removePhoto}
          />
        )}
      </ScrollView>

      {/* Footer */}
      <View style={s.footer}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={goBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={18} color={COLORS.text} />
          <Text style={s.backBtnText}>{step === 1 ? 'Cancel' : 'Back'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.nextBtn, (!stepValid || submitting) && s.btnDisabled]}
          onPress={goNext}
          disabled={!stepValid || submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Text style={s.nextBtnText}>
                {step === TOTAL_STEPS ? 'Submit Request' : 'Continue'}
              </Text>
              <Ionicons
                name={step === TOTAL_STEPS ? 'checkmark' : 'arrow-forward'}
                size={18}
                color={COLORS.white}
              />
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ============================================================
   Step components
   ============================================================ */
function Step1({ form, toggleService }) {
  return (
    <View>
      <Text style={s.stepTitle}>What services do you need?</Text>
      <Text style={s.stepSubtitle}>Select all that apply</Text>
      {SERVICES.map((svc) => {
        const selected = form.services.includes(svc.key);
        return (
          <TouchableOpacity
            key={svc.key}
            style={[s.selectableCard, selected && s.selectableCardActive]}
            onPress={() => toggleService(svc.key)}
            activeOpacity={0.85}
          >
            <View
              style={[
                s.selectableIcon,
                selected && { backgroundColor: COLORS.accent + '20' },
              ]}
            >
              <Ionicons
                name={svc.icon}
                size={22}
                color={selected ? COLORS.accent : COLORS.textLight}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  s.selectableTitle,
                  selected && { color: COLORS.accent },
                ]}
              >
                {svc.label}
              </Text>
              <Text style={s.selectableDesc}>{svc.desc}</Text>
            </View>
            <View style={[s.checkbox, selected && s.checkboxActive]}>
              {selected ? (
                <Ionicons name="checkmark" size={16} color={COLORS.white} />
              ) : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Step2({ form, update }) {
  return (
    <View>
      <Text style={s.stepTitle}>What type of wood?</Text>
      <Text style={s.stepSubtitle}>Choose your floor material</Text>
      <View style={s.gridWrap}>
        {WOOD_TYPES.map((w) => {
          const selected = form.wood_type === w.key;
          return (
            <TouchableOpacity
              key={w.key}
              style={[s.gridCard, selected && s.gridCardActive]}
              onPress={() => {
                if (Platform.OS !== 'web')
                  Haptics.selectionAsync().catch(() => {});
                update({ wood_type: w.key });
              }}
              activeOpacity={0.85}
            >
              <Ionicons
                name={w.icon}
                size={28}
                color={selected ? COLORS.white : COLORS.accent}
              />
              <Text
                style={[s.gridCardLabel, selected && { color: COLORS.white }]}
              >
                {w.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function Step3({ form, update }) {
  return (
    <View>
      <Text style={s.stepTitle}>Project size & type</Text>
      <Text style={s.stepSubtitle}>Helps us estimate accurately</Text>

      <Text style={s.label}>Approximate size (sq ft)</Text>
      <View style={s.inputWithUnit}>
        <TextInput
          style={[s.input, { flex: 1 }]}
          placeholder="e.g. 500"
          placeholderTextColor={COLORS.lightGray}
          value={form.size}
          onChangeText={(v) => update({ size: v.replace(/[^0-9.]/g, '') })}
          keyboardType="numeric"
        />
        <Text style={s.inputUnit}>sq ft</Text>
      </View>

      <Text style={s.label}>Property type</Text>
      <View style={s.gridWrap}>
        {PROPERTY_TYPES.map((p) => {
          const selected = form.property_type === p.key;
          return (
            <TouchableOpacity
              key={p.key}
              style={[s.gridCard, selected && s.gridCardActive]}
              onPress={() => {
                if (Platform.OS !== 'web')
                  Haptics.selectionAsync().catch(() => {});
                update({ property_type: p.key });
              }}
              activeOpacity={0.85}
            >
              <Ionicons
                name={p.icon}
                size={26}
                color={selected ? COLORS.white : COLORS.accent}
              />
              <Text
                style={[s.gridCardLabel, selected && { color: COLORS.white }]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function Step4({ form, update }) {
  return (
    <View>
      <Text style={s.stepTitle}>When & where?</Text>
      <Text style={s.stepSubtitle}>Address and timeframe</Text>

      <Text style={s.label}>Project address</Text>
      <TextInput
        style={s.input}
        placeholder="123 Main St, City, State"
        placeholderTextColor={COLORS.lightGray}
        value={form.address}
        onChangeText={(v) => update({ address: v })}
        autoCorrect={false}
      />

      <Text style={s.label}>When do you need it done?</Text>
      {TIMEFRAMES.map((t) => {
        const selected = form.timeframe === t.key;
        return (
          <TouchableOpacity
            key={t.key}
            style={[s.selectableCard, selected && s.selectableCardActive]}
            onPress={() => {
              if (Platform.OS !== 'web')
                Haptics.selectionAsync().catch(() => {});
              update({ timeframe: t.key });
            }}
            activeOpacity={0.85}
          >
            <View
              style={[
                s.selectableIcon,
                selected && { backgroundColor: COLORS.accent + '20' },
              ]}
            >
              <Ionicons
                name="time"
                size={20}
                color={selected ? COLORS.accent : COLORS.textLight}
              />
            </View>
            <Text
              style={[
                s.selectableTitle,
                selected && { color: COLORS.accent },
                { flex: 1 },
              ]}
            >
              {t.label}
            </Text>
            <View style={[s.radio, selected && s.radioActive]}>
              {selected ? <View style={s.radioInner} /> : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Step5({ form, update, pickImage, takePhoto, removePhoto }) {
  return (
    <View>
      <Text style={s.stepTitle}>Photos & notes</Text>
      <Text style={s.stepSubtitle}>
        Optional — but photos help us bid accurately
      </Text>

      <Text style={s.label}>Photos of the project area</Text>
      <View style={s.photoActions}>
        <TouchableOpacity
          style={s.photoActionBtn}
          onPress={takePhoto}
          activeOpacity={0.85}
        >
          <Ionicons name="camera" size={22} color={COLORS.accent} />
          <Text style={s.photoActionText}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.photoActionBtn}
          onPress={pickImage}
          activeOpacity={0.85}
        >
          <Ionicons name="images" size={22} color={COLORS.accent} />
          <Text style={s.photoActionText}>From Library</Text>
        </TouchableOpacity>
      </View>

      {form.photos.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.photoStrip}
        >
          {form.photos.map((uri, idx) => (
            <View key={`${uri}-${idx}`} style={s.photoThumb}>
              <Image source={{ uri }} style={s.photoImg} />
              <TouchableOpacity
                style={s.photoRemove}
                onPress={() => removePhoto(idx)}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <Ionicons
                  name="close-circle"
                  size={22}
                  color={COLORS.red || '#DC3545'}
                />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <Text style={s.label}>Additional notes</Text>
      <TextInput
        style={[s.input, { minHeight: 100, textAlignVertical: 'top' }]}
        placeholder="Room layout, special requests, anything else we should know…"
        placeholderTextColor={COLORS.lightGray}
        value={form.notes}
        onChangeText={(v) => update({ notes: v })}
        multiline
        maxLength={1000}
      />
      <Text style={s.charCount}>{form.notes.length} / 1000</Text>

      {/* Summary */}
      <View style={s.summary}>
        <Text style={s.summaryTitle}>Quick Summary</Text>
        <View style={s.summaryDivider} />
        <SummaryRow
          label="Services"
          value={
            form.services
              .map((k) => SERVICES.find((sv) => sv.key === k)?.label)
              .filter(Boolean)
              .join(', ') || '—'
          }
        />
        <SummaryRow
          label="Wood type"
          value={
            WOOD_TYPES.find((w) => w.key === form.wood_type)?.label || '—'
          }
        />
        <SummaryRow
          label="Size"
          value={form.size ? `${form.size} sq ft` : '—'}
        />
        <SummaryRow
          label="Property"
          value={
            PROPERTY_TYPES.find((p) => p.key === form.property_type)?.label ||
            '—'
          }
        />
        <SummaryRow
          label="Timeframe"
          value={
            TIMEFRAMES.find((t) => t.key === form.timeframe)?.label || '—'
          }
        />
        <SummaryRow label="Address" value={form.address || '—'} />
        <SummaryRow
          label="Photos"
          value={
            form.photos.length > 0
              ? `${form.photos.length} attached`
              : 'None'
          }
        />
      </View>
    </View>
  );
}

function SummaryRow({ label, value }) {
  return (
    <View style={s.summaryRow}>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={s.summaryValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },

  /* Progress */
  progressBar: { height: 4, backgroundColor: COLORS.lightGray },
  progressFill: { height: 4, backgroundColor: COLORS.accent },
  progressLabel: { paddingHorizontal: 20, paddingTop: 10 },
  progressText: { fontSize: 12, color: COLORS.textLight, fontWeight: '600' },

  scroll: { padding: 20, paddingBottom: 40 },

  stepTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  stepSubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 4,
    marginBottom: 20,
  },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 10,
    marginTop: 18,
  },

  /* Selectable list card */
  selectableCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  selectableCardActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent + '08',
  },
  selectableIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.offWhite,
    marginRight: 12,
  },
  selectableTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  selectableDesc: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: { borderColor: COLORS.accent },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
  },

  /* Grid */
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCard: {
    width: '31%',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  gridCardActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  gridCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 8,
    textAlign: 'center',
  },

  /* Input */
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  inputWithUnit: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputUnit: { fontSize: 14, color: COLORS.textLight, fontWeight: '600' },
  charCount: {
    textAlign: 'right',
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 4,
  },

  /* Photos */
  photoActions: { flexDirection: 'row', gap: 10 },
  photoActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.accent + '40',
  },
  photoActionText: { fontSize: 13, fontWeight: '700', color: COLORS.accent },
  photoStrip: { paddingVertical: 12, gap: 10 },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 10,
    position: 'relative',
  },
  photoImg: { width: '100%', height: '100%', borderRadius: 12 },
  photoRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: COLORS.white,
    borderRadius: 12,
  },

  /* Summary */
  summary: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  summaryDivider: {
    height: 1,
    backgroundColor: COLORS.lightGray,
    marginVertical: 10,
  },
  summaryRow: { flexDirection: 'row', marginBottom: 8 },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '600',
    width: 90,
  },
  summaryValue: { fontSize: 13, color: COLORS.text, flex: 1 },

  /* Footer */
  footer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    gap: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.offWhite,
  },
  backBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
});
