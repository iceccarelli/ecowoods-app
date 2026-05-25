/**
 * CalendarScreen — v4.0
 * ─────────────────────────────────────────────────────────────────────
 * • useQuery for events list (synced via store realtime events)
 * • useMutation for createEvent — optimistic with rollback
 * • react-native-calendars with multi-dot marking by event type
 * • Selected date events + upcoming events section
 * • Bottom-sheet modal for adding new events
 * • Haptic feedback on date tap / event create / type-chip select
 *
 * File location: frontend/screens/CalendarScreen.js  (replace existing)
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import api from '../services/api';
import useStore from '../context/useStore';
import { COLORS } from '../styles';

const EVENT_TYPES = [
  { key: 'job', label: 'Job', color: COLORS.accent, icon: 'construct' },
  {
    key: 'deadline',
    label: 'Deadline',
    color: COLORS.red || '#DC3545',
    icon: 'alarm',
  },
  { key: 'meeting', label: 'Meeting', color: '#3498DB', icon: 'people' },
  {
    key: 'reminder',
    label: 'Reminder',
    color: '#8E44AD',
    icon: 'notifications',
  },
];

const today = () => new Date().toISOString().split('T')[0];

export default function CalendarScreen({ navigation }) {
  const queryClient = useQueryClient();
  const storeEvents = useStore((s) => s.events);

  const [selectedDate, setSelectedDate] = useState(today());
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newEventType, setNewEventType] = useState('job');
  const [creating, setCreating] = useState(false);

  /* ── Query: events ─────────────────────────────────────── */
  const {
    data: events = [],
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.listEvents(),
    initialData:
      Array.isArray(storeEvents) && storeEvents.length > 0
        ? storeEvents
        : undefined,
    placeholderData: (prev) => prev,
  });

  /* ── Mutation: createEvent (optimistic) ───────────────── */
  const createMutation = useMutation({
    mutationFn: (data) => api.createEvent(data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['events'] });
      const previous = queryClient.getQueryData(['events']);
      const optimistic = {
        id: `tmp-${Date.now()}`,
        created_at: new Date().toISOString(),
        ...data,
        __optimistic: true,
      };
      queryClient.setQueryData(['events'], (old) =>
        Array.isArray(old) ? [optimistic, ...old] : [optimistic]
      );
      return { previous, tempId: optimistic.id };
    },
    onError: (err, _data, ctx) => {
      queryClient.setQueryData(['events'], ctx?.previous);
      Alert.alert(
        "Couldn't create event",
        err?.message || 'Please try again.'
      );
    },
    onSuccess: () => {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(() => {});
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });

  /* ── Derived: marked dates for calendar ──────────────── */
  const markedDates = useMemo(() => {
    const marks = {};
    events.forEach((ev) => {
      const date = ev.start_date || ev.date;
      if (!date) return;
      const typeConfig =
        EVENT_TYPES.find((t) => t.key === ev.event_type) || EVENT_TYPES[0];
      if (marks[date]) {
        marks[date].dots = marks[date].dots || [];
        if (!marks[date].dots.find((d) => d.color === typeConfig.color)) {
          marks[date].dots.push({ color: typeConfig.color });
        }
      } else {
        marks[date] = {
          marked: true,
          dots: [{ color: typeConfig.color }],
        };
      }
    });
    if (selectedDate) {
      marks[selectedDate] = {
        ...(marks[selectedDate] || {}),
        selected: true,
        selectedColor: COLORS.accent,
      };
    }
    return marks;
  }, [events, selectedDate]);

  const selectedEvents = useMemo(
    () =>
      events
        .filter((ev) => (ev.start_date || ev.date) === selectedDate)
        .sort((a, b) =>
          (a.created_at || '').localeCompare(b.created_at || '')
        ),
    [events, selectedDate]
  );

  const upcomingEvents = useMemo(() => {
    const t = today();
    return events
      .filter((ev) => {
        const d = ev.start_date || ev.date;
        return d && d >= t;
      })
      .sort((a, b) => {
        const da = a.start_date || a.date || '';
        const db = b.start_date || b.date || '';
        return da.localeCompare(db);
      })
      .slice(0, 10);
  }, [events]);

  /* ── Handlers ──────────────────────────────────────────── */
  const onRefresh = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    await refetch();
  }, [refetch]);

  const handleDayPress = useCallback((day) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setSelectedDate(day.dateString);
  }, []);

  const openModal = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setNewTitle('');
    setNewDescription('');
    setNewEventType('job');
  }, []);

  const handleAddEvent = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Title required', 'Please enter a title for your event.');
      return;
    }
    if (!selectedDate) {
      Alert.alert('Date required', 'Please select a date on the calendar.');
      return;
    }
    setCreating(true);
    try {
      await createMutation.mutateAsync({
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        start_date: selectedDate,
        event_type: newEventType,
      });
      closeModal();
    } catch (e) {
      // handled by onError
    } finally {
      setCreating(false);
    }
  };

  /* ── Render ────────────────────────────────────────────── */
  return (
    <View style={s.container}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Calendar
          onDayPress={handleDayPress}
          markedDates={markedDates}
          markingType="multi-dot"
          theme={{
            backgroundColor: COLORS.white,
            calendarBackground: COLORS.white,
            todayTextColor: COLORS.accent,
            arrowColor: COLORS.accent,
            selectedDayBackgroundColor: COLORS.accent,
            selectedDayTextColor: COLORS.white,
            dotColor: COLORS.accent,
            textDayFontWeight: '500',
            textMonthFontWeight: '700',
            textMonthFontSize: 18,
            textDayHeaderFontWeight: '600',
            textSectionTitleColor: COLORS.textLight,
            textDayFontSize: 14,
          }}
          style={s.calendar}
        />

        {/* Type legend */}
        <View style={s.legend}>
          {EVENT_TYPES.map((t) => (
            <View key={t.key} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: t.color }]} />
              <Text style={s.legendLabel}>{t.label}</Text>
            </View>
          ))}
        </View>

        {/* Selected date section */}
        <View style={s.eventsSection}>
          <View style={s.sectionHeader}>
            <View>
              <Text style={s.sectionTitle}>
                {selectedDate === today()
                  ? 'Today'
                  : new Date(selectedDate).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
              </Text>
              <Text style={s.sectionSubtitle}>
                {selectedEvents.length}{' '}
                {selectedEvents.length === 1 ? 'event' : 'events'}
              </Text>
            </View>
            <TouchableOpacity
              style={s.addBtn}
              onPress={openModal}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={22} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          {selectedEvents.length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons
                name="calendar-outline"
                size={36}
                color={COLORS.lightGray}
              />
              <Text style={s.emptyText}>No events on this date</Text>
              <TouchableOpacity onPress={openModal}>
                <Text style={s.emptyLink}>+ Add event</Text>
              </TouchableOpacity>
            </View>
          ) : (
            selectedEvents.map((ev) => <EventCard key={ev.id} event={ev} />)
          )}
        </View>

        {/* Upcoming */}
        {upcomingEvents.length > 0 ? (
          <View style={s.eventsSection}>
            <Text style={s.sectionTitle}>
              Upcoming ({upcomingEvents.length})
            </Text>
            <View style={{ marginTop: 12 }}>
              {upcomingEvents.map((ev) => (
                <EventCard
                  key={`up-${ev.id}`}
                  event={ev}
                  showDate
                  onPress={
                    ev.job_request_id
                      ? () =>
                          navigation.navigate('JobsTab', {
                            screen: 'RequestEstimate',
                            params: { jobId: ev.job_request_id },
                          })
                      : undefined
                  }
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Add Event Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.modalOverlay}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={s.modalBackdrop}
            onPress={closeModal}
          />
          <View style={s.modalContent}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>New Event</Text>
              <TouchableOpacity
                onPress={closeModal}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={s.modalDate}>
              {new Date(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>

            <Text style={s.label}>Type</Text>
            <View style={s.typeRow}>
              {EVENT_TYPES.map((t) => {
                const selected = newEventType === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[
                      s.typeChip,
                      selected && { backgroundColor: t.color, borderColor: t.color },
                    ]}
                    onPress={() => {
                      if (Platform.OS !== 'web')
                        Haptics.selectionAsync().catch(() => {});
                      setNewEventType(t.key);
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={t.icon}
                      size={14}
                      color={selected ? COLORS.white : t.color}
                    />
                    <Text
                      style={[
                        s.typeChipText,
                        selected && { color: COLORS.white },
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.label}>Title</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Install hardwood — living room"
              placeholderTextColor={COLORS.lightGray}
              value={newTitle}
              onChangeText={setNewTitle}
              maxLength={100}
            />

            <Text style={s.label}>Description (optional)</Text>
            <TextInput
              style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]}
              placeholder="Notes, location, attendees…"
              placeholderTextColor={COLORS.lightGray}
              value={newDescription}
              onChangeText={setNewDescription}
              multiline
              maxLength={500}
            />

            <TouchableOpacity
              style={[s.submitBtn, creating && { opacity: 0.6 }]}
              onPress={handleAddEvent}
              disabled={creating}
              activeOpacity={0.85}
            >
              <Text style={s.submitBtnText}>
                {creating ? 'Creating…' : 'Create Event'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function EventCard({ event, showDate, onPress }) {
  const typeConfig =
    EVENT_TYPES.find((t) => t.key === event.event_type) || EVENT_TYPES[0];
  const date = event.start_date || event.date;

  const inner = (
    <View
      style={[s.eventCard, event.__optimistic && { opacity: 0.55 }]}
    >
      <View style={[s.eventStripe, { backgroundColor: typeConfig.color }]} />
      <View style={s.eventContent}>
        <View style={s.eventTopRow}>
          <Text style={s.eventTitle} numberOfLines={1}>
            {event.title}
          </Text>
          <View
            style={[
              s.eventTypeBadge,
              { backgroundColor: typeConfig.color + '20' },
            ]}
          >
            <Text
              style={[s.eventTypeBadgeText, { color: typeConfig.color }]}
            >
              {typeConfig.label}
            </Text>
          </View>
        </View>
        {event.description ? (
          <Text style={s.eventDesc} numberOfLines={2}>
            {event.description}
          </Text>
        ) : null}
        <View style={s.eventMeta}>
          {showDate && date ? (
            <>
              <Ionicons
                name="calendar-outline"
                size={12}
                color={COLORS.textLight}
              />
              <Text style={s.eventMetaText}>{date}</Text>
            </>
          ) : null}
          {event.job_request_id ? (
            <>
              {showDate && date ? (
                <Text style={s.eventMetaText}>·</Text>
              ) : null}
              <Ionicons
                name="clipboard-outline"
                size={12}
                color={COLORS.textLight}
              />
              <Text style={s.eventMetaText}>
                Job #{event.job_request_id}
              </Text>
            </>
          ) : null}
        </View>
      </View>
      {onPress ? (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={COLORS.lightGray}
          style={{ alignSelf: 'center', marginRight: 12 }}
        />
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },
  calendar: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    paddingBottom: 8,
  },

  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.white,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexWrap: 'wrap',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 12, color: COLORS.textLight, fontWeight: '500' },

  eventsSection: { padding: 16 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },

  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderStyle: 'dashed',
  },
  emptyText: { fontSize: 14, color: COLORS.textLight, marginTop: 10 },
  emptyLink: {
    fontSize: 14,
    color: COLORS.accent,
    fontWeight: '600',
    marginTop: 8,
  },

  eventCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  eventStripe: { width: 4 },
  eventContent: { flex: 1, padding: 14 },
  eventTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  eventTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  eventTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  eventDesc: { fontSize: 13, color: COLORS.textLight, marginTop: 4 },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  eventMetaText: { fontSize: 12, color: COLORS.textLight },

  /* Modal */
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.lightGray,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  modalDate: {
    fontSize: 14,
    color: COLORS.accent,
    marginBottom: 18,
    fontWeight: '600',
  },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    backgroundColor: COLORS.offWhite,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },

  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.offWhite,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  typeChipText: { fontSize: 13, fontWeight: '600', color: COLORS.text },

  submitBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 22,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
