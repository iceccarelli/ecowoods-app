/**
 * CalendarScreen - View calendar events with a calendar widget.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    TextInput,
    Alert,
    Modal,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import useStore from '../context/useStore';
import { COLORS } from '../styles';

export default function CalendarScreen() {
    const { events, eventsLoading, fetchEvents, createEvent } = useStore();
    const [selectedDate, setSelectedDate] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');

    useEffect(() => {
        fetchEvents().catch(() => {});
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await fetchEvents();
        } catch (e) {}
        setRefreshing(false);
    };

    // Build marked dates for the calendar
    const markedDates = {};
    events.forEach((ev) => {
        if (ev.start_date) {
            markedDates[ev.start_date] = {
                marked: true,
                dotColor: ev.event_type === 'deadline' ? COLORS.red : COLORS.accent,
                ...(ev.start_date === selectedDate ? { selected: true, selectedColor: COLORS.accent } : {}),
            };
        }
    });
    if (selectedDate && !markedDates[selectedDate]) {
        markedDates[selectedDate] = { selected: true, selectedColor: COLORS.accent };
    }

    const selectedEvents = events.filter((ev) => ev.start_date === selectedDate);

    const handleAddEvent = async () => {
        if (!newTitle.trim()) {
            Alert.alert('Error', 'Please enter a title.');
            return;
        }
        if (!selectedDate) {
            Alert.alert('Error', 'Please select a date on the calendar first.');
            return;
        }
        try {
            await createEvent({
                title: newTitle.trim(),
                description: newDescription.trim() || null,
                start_date: selectedDate,
                event_type: 'job',
            });
            setShowModal(false);
            setNewTitle('');
            setNewDescription('');
            Alert.alert('Success', 'Event created!');
        } catch (e) {
            Alert.alert('Error', e.message || 'Failed to create event.');
        }
    };

    return (
        <View style={s.container}>
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <Calendar
                    onDayPress={(day) => setSelectedDate(day.dateString)}
                    markedDates={markedDates}
                    theme={{
                        backgroundColor: COLORS.white,
                        calendarBackground: COLORS.white,
                        todayTextColor: COLORS.accent,
                        arrowColor: COLORS.accent,
                        selectedDayBackgroundColor: COLORS.accent,
                        dotColor: COLORS.accent,
                        textDayFontWeight: '500',
                        textMonthFontWeight: '700',
                        textMonthFontSize: 18,
                    }}
                    style={s.calendar}
                />

                {/* Selected Date Events */}
                <View style={s.eventsSection}>
                    <View style={s.eventsSectionHeader}>
                        <Text style={s.sectionTitle}>
                            {selectedDate
                                ? `Events on ${selectedDate}`
                                : 'Select a date to view events'}
                        </Text>
                        {selectedDate && (
                            <TouchableOpacity
                                style={s.addBtn}
                                onPress={() => setShowModal(true)}
                            >
                                <Ionicons name="add" size={20} color={COLORS.white} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {selectedDate && selectedEvents.length === 0 && (
                        <View style={s.emptyCard}>
                            <Text style={s.emptyText}>No events on this date.</Text>
                        </View>
                    )}

                    {selectedEvents.map((ev) => (
                        <View key={ev.id} style={s.eventCard}>
                            <View style={[s.eventDot, ev.event_type === 'deadline' && { backgroundColor: COLORS.red }]} />
                            <View style={s.eventContent}>
                                <Text style={s.eventTitle}>{ev.title}</Text>
                                {ev.description && <Text style={s.eventDesc}>{ev.description}</Text>}
                                <Text style={s.eventMeta}>
                                    {ev.event_type} {ev.job_request_id ? `· Job #${ev.job_request_id}` : ''}
                                </Text>
                            </View>
                        </View>
                    ))}

                    {/* All upcoming events */}
                    <Text style={[s.sectionTitle, { marginTop: 24 }]}>All Events ({events.length})</Text>
                    {events.length === 0 ? (
                        <View style={s.emptyCard}>
                            <Ionicons name="calendar-outline" size={40} color={COLORS.lightGray} />
                            <Text style={s.emptyText}>No events yet.</Text>
                        </View>
                    ) : (
                        events
                            .sort((a, b) => a.start_date.localeCompare(b.start_date))
                            .map((ev) => (
                                <View key={ev.id} style={s.eventCard}>
                                    <View style={[s.eventDot, ev.event_type === 'deadline' && { backgroundColor: COLORS.red }]} />
                                    <View style={s.eventContent}>
                                        <Text style={s.eventTitle}>{ev.title}</Text>
                                        <Text style={s.eventMeta}>{ev.start_date} · {ev.event_type}</Text>
                                    </View>
                                </View>
                            ))
                    )}
                </View>
            </ScrollView>

            {/* Add Event Modal */}
            <Modal visible={showModal} transparent animationType="slide">
                <View style={s.modalOverlay}>
                    <View style={s.modalContent}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>New Event</Text>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
                                <Ionicons name="close" size={24} color={COLORS.text} />
                            </TouchableOpacity>
                        </View>
                        <Text style={s.modalDate}>Date: {selectedDate}</Text>

                        <Text style={s.label}>Title</Text>
                        <TextInput
                            style={s.input}
                            placeholder="Event title"
                            value={newTitle}
                            onChangeText={setNewTitle}
                        />

                        <Text style={s.label}>Description (optional)</Text>
                        <TextInput
                            style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]}
                            placeholder="Description"
                            value={newDescription}
                            onChangeText={setNewDescription}
                            multiline
                        />

                        <TouchableOpacity style={s.submitBtn} onPress={handleAddEvent}>
                            <Text style={s.submitBtnText}>Create Event</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.offWhite },
    calendar: {
        borderBottomWidth: 1,
        borderBottomColor: COLORS.lightGray,
    },
    eventsSection: { padding: 16 },
    eventsSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
    addBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.accent,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyCard: {
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
    },
    emptyText: { fontSize: 14, color: COLORS.textLight, marginTop: 8 },
    eventCard: {
        backgroundColor: COLORS.white,
        borderRadius: 10,
        padding: 14,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'flex-start',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    eventDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: COLORS.accent,
        marginTop: 5,
        marginRight: 12,
    },
    eventContent: { flex: 1 },
    eventTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text },
    eventDesc: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
    eventMeta: { fontSize: 12, color: COLORS.gray, marginTop: 4, textTransform: 'capitalize' },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
    modalDate: { fontSize: 14, color: COLORS.accent, marginBottom: 16 },
    label: { fontSize: 13, fontWeight: '500', color: COLORS.textLight, marginBottom: 6, marginTop: 12 },
    input: {
        backgroundColor: COLORS.offWhite,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: COLORS.text,
    },
    submitBtn: {
        backgroundColor: COLORS.accent,
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 20,
    },
    submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
});
