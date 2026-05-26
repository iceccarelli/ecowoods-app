/**
 * CalendarScreen - View calendar events with a calendar widget.
 * UPGRADED VERSION v2.0 - Perfect Execution Stack + Safe Data Handling
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
    const { 
        events = [], 
        eventsLoading = false, 
        fetchEvents, 
        createEvent 
    } = useStore();

    const [selectedDate, setSelectedDate] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');

    // Safe fetch on mount
    useEffect(() => {
        const loadEvents = async () => {
            try {
                await fetchEvents?.();
            } catch (error) {
                console.warn('Failed to load events:', error);
            }
        };
        loadEvents();
    }, [fetchEvents]);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await fetchEvents?.();
        } catch (e) {
            console.warn('Refresh failed:', e);
        }
        setRefreshing(false);
    };

    // ==================== SAFE DATA PROCESSING ====================
    
    // Filter out invalid events (perfect consistency)
    const validEvents = useMemo(() => {
        return (events || []).filter(ev => 
            ev && 
            typeof ev === 'object' && 
            ev.id && 
            ev.title
        );
    }, [events]);

    // Build marked dates for the calendar (with safety)
    const markedDates = useMemo(() => {
        const marks = {};
        
        validEvents.forEach((ev) => {
            const dateStr = ev.start_date || ev.date || ev.startDate;
            if (dateStr && typeof dateStr === 'string') {
                marks[dateStr] = {
                    marked: true,
                    dotColor: ev.event_type === 'deadline' ? COLORS.red : COLORS.accent,
                    ...(dateStr === selectedDate ? { selected: true, selectedColor: COLORS.accent } : {}),
                };
            }
        });

        if (selectedDate && !marks[selectedDate]) {
            marks[selectedDate] = { selected: true, selectedColor: COLORS.accent };
        }

        return marks;
    }, [validEvents, selectedDate]);

    // Get events for selected date (safe)
    const selectedEvents = useMemo(() => {
        if (!selectedDate) return [];
        return validEvents.filter((ev) => {
            const dateStr = ev.start_date || ev.date || ev.startDate;
            return dateStr === selectedDate;
        });
    }, [validEvents, selectedDate]);

    // Safe sorted events for "All Events" section
    const sortedAllEvents = useMemo(() => {
        return [...validEvents].sort((a, b) => {
            const dateA = a.start_date || a.date || a.startDate || '';
            const dateB = b.start_date || b.date || b.startDate || '';
            
            // Safe localeCompare with fallback
            try {
                return dateA.localeCompare(dateB);
            } catch (e) {
                return dateA > dateB ? 1 : dateA < dateB ? -1 : 0;
            }
        });
    }, [validEvents]);

    // ==================== EVENT HANDLERS ====================

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
            await createEvent?.({
                title: newTitle.trim(),
                description: newDescription.trim() || null,
                start_date: selectedDate,
                event_type: 'job',
            });
            
            setShowModal(false);
            setNewTitle('');
            setNewDescription('');
            Alert.alert('Success', 'Event created successfully!');
        } catch (e) {
            Alert.alert('Error', e?.message || 'Failed to create event. Please try again.');
        }
    };

    // ==================== RENDER ====================

    if (eventsLoading && !refreshing) {
        return (
            <View style={s.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.accent} />
                <Text style={s.loadingText}>Loading calendar...</Text>
            </View>
        );
    }

    return (
        <View style={s.container}>
            <ScrollView
                refreshControl={
                    <RefreshControl 
                        refreshing={refreshing} 
                        onRefresh={onRefresh}
                        colors={[COLORS.accent]}
                        tintColor={COLORS.accent}
                    />
                }
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                {/* Calendar Widget */}
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
                        textDayHeaderFontWeight: '600',
                    }}
                    style={s.calendar}
                    enableSwipeMonths={true}
                />

                {/* Selected Date Events Section */}
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
                                activeOpacity={0.8}
                            >
                                <Ionicons name="add" size={20} color={COLORS.white} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Empty State for Selected Date */}
                    {selectedDate && selectedEvents.length === 0 && (
                        <View style={s.emptyCard}>
                            <Ionicons name="calendar-outline" size={36} color={COLORS.lightGray} />
                            <Text style={s.emptyText}>No events scheduled for this date.</Text>
                            <TouchableOpacity 
                                style={s.addEventHint} 
                                onPress={() => setShowModal(true)}
                            >
                                <Text style={s.addEventHintText}>+ Add Event</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Selected Date Events List */}
                    {selectedEvents.map((ev) => (
                        <View key={ev.id} style={s.eventCard}>
                            <View style={[
                                s.eventDot, 
                                ev.event_type === 'deadline' && { backgroundColor: COLORS.red }
                            ]} />
                            <View style={s.eventContent}>
                                <Text style={s.eventTitle}>{ev.title}</Text>
                                {ev.description && (
                                    <Text style={s.eventDesc} numberOfLines={2}>
                                        {ev.description}
                                    </Text>
                                )}
                                <Text style={s.eventMeta}>
                                    {ev.event_type || 'event'} 
                                    {ev.job_request_id ? `  ·  Job #${ev.job_request_id}` : ''}
                                </Text>
                            </View>
                        </View>
                    ))}

                    {/* All Events Section */}
                    <View style={s.allEventsHeader}>
                        <Text style={s.sectionTitle}>
                            All Events ({sortedAllEvents.length})
                        </Text>
                        {sortedAllEvents.length > 0 && (
                            <Text style={s.eventCountBadge}>
                                {sortedAllEvents.length} total
                            </Text>
                        )}
                    </View>

                    {sortedAllEvents.length === 0 ? (
                        <View style={s.emptyCard}>
                            <Ionicons name="calendar-outline" size={40} color={COLORS.lightGray} />
                            <Text style={s.emptyText}>No events yet.</Text>
                            <Text style={s.emptySubtext}>
                                Pull down to refresh or add your first event.
                            </Text>
                        </View>
                    ) : (
                        sortedAllEvents.map((ev) => {
                            const displayDate = ev.start_date || ev.date || ev.startDate || 'No date';
                            return (
                                <View key={ev.id} style={s.eventCard}>
                                    <View style={[
                                        s.eventDot, 
                                        ev.event_type === 'deadline' && { backgroundColor: COLORS.red }
                                    ]} />
                                    <View style={s.eventContent}>
                                        <Text style={s.eventTitle}>{ev.title}</Text>
                                        <Text style={s.eventMeta}>
                                            {displayDate}  ·  {ev.event_type || 'event'}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>
            </ScrollView>

            {/* Add Event Modal */}
            <Modal 
                visible={showModal} 
                transparent 
                animationType="slide"
                onRequestClose={() => setShowModal(false)}
            >
                <View style={s.modalOverlay}>
                    <View style={s.modalContent}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>New Event</Text>
                            <TouchableOpacity 
                                onPress={() => setShowModal(false)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="close" size={24} color={COLORS.text} />
                            </TouchableOpacity>
                        </View>

                        <Text style={s.modalDate}>Date: {selectedDate}</Text>

                        <Text style={s.label}>Title *</Text>
                        <TextInput
                            style={s.input}
                            placeholder="Event title"
                            placeholderTextColor={COLORS.gray}
                            value={newTitle}
                            onChangeText={setNewTitle}
                            autoFocus
                        />

                        <Text style={s.label}>Description (optional)</Text>
                        <TextInput
                            style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]}
                            placeholder="Add details..."
                            placeholderTextColor={COLORS.gray}
                            value={newDescription}
                            onChangeText={setNewDescription}
                            multiline
                        />

                        <TouchableOpacity 
                            style={s.submitBtn} 
                            onPress={handleAddEvent}
                            activeOpacity={0.85}
                        >
                            <Text style={s.submitBtnText}>Create Event</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ==================== STYLES ====================
const s = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: COLORS.offWhite 
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.offWhite,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: COLORS.textLight,
    },
    calendar: {
        borderBottomWidth: 1,
        borderBottomColor: COLORS.lightGray,
        paddingBottom: 8,
    },
    eventsSection: { 
        padding: 16,
        paddingTop: 20,
    },
    eventsSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    allEventsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 28,
        marginBottom: 14,
    },
    sectionTitle: { 
        fontSize: 17, 
        fontWeight: '700', 
        color: COLORS.text 
    },
    eventCountBadge: {
        fontSize: 12,
        color: COLORS.accent,
        backgroundColor: COLORS.accent + '15',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        fontWeight: '600',
    },
    addBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: COLORS.accent,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    emptyCard: {
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: 28,
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.lightGray,
    },
    emptyText: { 
        fontSize: 15, 
        color: COLORS.textLight, 
        marginTop: 12,
        textAlign: 'center',
        fontWeight: '500',
    },
    emptySubtext: {
        fontSize: 13,
        color: COLORS.gray,
        marginTop: 6,
        textAlign: 'center',
    },
    addEventHint: {
        marginTop: 16,
        paddingHorizontal: 20,
        paddingVertical: 8,
        backgroundColor: COLORS.accent + '15',
        borderRadius: 20,
    },
    addEventHintText: {
        color: COLORS.accent,
        fontWeight: '600',
        fontSize: 14,
    },
    eventCard: {
        backgroundColor: COLORS.white,
        borderRadius: 14,
        padding: 16,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'flex-start',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
        borderWidth: 1,
        borderColor: COLORS.lightGray + '40',
    },
    eventDot: {
        width: 11,
        height: 11,
        borderRadius: 6,
        backgroundColor: COLORS.accent,
        marginTop: 4,
        marginRight: 14,
    },
    eventContent: { 
        flex: 1,
        paddingRight: 4,
    },
    eventTitle: { 
        fontSize: 15.5, 
        fontWeight: '700', 
        color: COLORS.text,
        lineHeight: 21,
    },
    eventDesc: { 
        fontSize: 13.5, 
        color: COLORS.textLight, 
        marginTop: 5,
        lineHeight: 19,
    },
    eventMeta: { 
        fontSize: 12, 
        color: COLORS.gray, 
        marginTop: 7,
        fontWeight: '500',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    modalTitle: { 
        fontSize: 22, 
        fontWeight: '800', 
        color: COLORS.text 
    },
    modalDate: { 
        fontSize: 14, 
        color: COLORS.accent, 
        marginBottom: 20,
        fontWeight: '600',
    },
    label: { 
        fontSize: 13, 
        fontWeight: '600', 
        color: COLORS.textLight, 
        marginBottom: 7, 
        marginTop: 14 
    },
    input: {
        backgroundColor: COLORS.offWhite,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 13,
        fontSize: 15.5,
        color: COLORS.text,
        borderWidth: 1,
        borderColor: COLORS.lightGray,
    },
    submitBtn: {
        backgroundColor: COLORS.accent,
        borderRadius: 14,
        paddingVertical: 15,
        alignItems: 'center',
        marginTop: 26,
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    submitBtnText: { 
        color: COLORS.white, 
        fontSize: 16, 
        fontWeight: '700',
        letterSpacing: 0.3,
    },
});
