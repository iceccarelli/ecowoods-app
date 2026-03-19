/**
 * RequestEstimateScreen - View estimate details for a job request.
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { COLORS } from '../styles';

export default function RequestEstimateScreen({ route, navigation }) {
    const { jobId } = route.params || {};
    const [job, setJob] = useState(null);
    const [bids, setBids] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            if (jobId) {
                const jobData = await api.getJobRequest(jobId);
                setJob(jobData);
                const bidsData = await api.listBids(jobId);
                setBids(bidsData);
            }
        } catch (e) {
            console.warn('Failed to load estimate data:', e.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={s.centered}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    if (!job) {
        return (
            <View style={s.centered}>
                <Ionicons name="document-text-outline" size={64} color={COLORS.lightGray} />
                <Text style={s.emptyText}>No estimate data available.</Text>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={s.scroll}>
            {/* Job Details Card */}
            <View style={s.card}>
                <View style={s.cardHeader}>
                    <Ionicons name="clipboard" size={20} color={COLORS.accent} />
                    <Text style={s.cardTitle}>Job Request #{job.id}</Text>
                </View>
                <View style={s.badge}>
                    <Text style={s.badgeText}>{job.status}</Text>
                </View>

                <View style={s.divider} />

                {job.services && job.services.length > 0 && (
                    <View style={s.detailRow}>
                        <Text style={s.detailLabel}>Services</Text>
                        <Text style={s.detailValue}>{job.services.join(', ')}</Text>
                    </View>
                )}
                {job.wood_type && (
                    <View style={s.detailRow}>
                        <Text style={s.detailLabel}>Wood Type</Text>
                        <Text style={s.detailValue}>{job.wood_type}</Text>
                    </View>
                )}
                {job.size && (
                    <View style={s.detailRow}>
                        <Text style={s.detailLabel}>Size</Text>
                        <Text style={s.detailValue}>{job.size} sq ft</Text>
                    </View>
                )}
                {job.property_type && (
                    <View style={s.detailRow}>
                        <Text style={s.detailLabel}>Property</Text>
                        <Text style={s.detailValue}>{job.property_type}</Text>
                    </View>
                )}
                {job.timeframe && (
                    <View style={s.detailRow}>
                        <Text style={s.detailLabel}>Timeframe</Text>
                        <Text style={s.detailValue}>{job.timeframe}</Text>
                    </View>
                )}
            </View>

            {/* Bids Section */}
            <Text style={s.sectionTitle}>Estimates / Bids ({bids.length})</Text>
            {bids.length === 0 ? (
                <View style={s.emptyCard}>
                    <Ionicons name="pricetag-outline" size={40} color={COLORS.lightGray} />
                    <Text style={s.emptyCardText}>No estimates yet. Check back soon!</Text>
                </View>
            ) : (
                bids.map((bid) => (
                    <TouchableOpacity
                        key={bid.id}
                        style={s.bidCard}
                        onPress={() => navigation.navigate('BidDetail', { bidId: bid.id })}
                    >
                        <View style={s.bidHeader}>
                            <Text style={s.bidAmount}>${parseFloat(bid.amount).toLocaleString()} {bid.currency}</Text>
                            <View style={[s.badge, bid.status === 'accepted' && s.badgeAccepted]}>
                                <Text style={s.badgeText}>{bid.status}</Text>
                            </View>
                        </View>
                        {bid.timeframe && <Text style={s.bidDetail}>Timeframe: {bid.timeframe}</Text>}
                        {bid.pickup_date && <Text style={s.bidDetail}>Pickup: {bid.pickup_date}</Text>}
                        {bid.notes && <Text style={s.bidNotes}>{bid.notes}</Text>}
                    </TouchableOpacity>
                ))
            )}
        </ScrollView>
    );
}

const s = StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.offWhite },
    scroll: { padding: 20 },
    card: {
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    cardTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text },
    badge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        backgroundColor: '#FFF3CD',
    },
    badgeAccepted: { backgroundColor: '#D4EDDA' },
    badgeText: { fontSize: 12, fontWeight: '500', color: '#856404' },
    divider: { height: 1, backgroundColor: COLORS.lightGray, marginVertical: 12 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    detailLabel: { fontSize: 14, color: COLORS.textLight },
    detailValue: { fontSize: 14, fontWeight: '500', color: COLORS.text, flex: 1, textAlign: 'right' },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
    emptyCard: {
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: 32,
        alignItems: 'center',
    },
    emptyCardText: { fontSize: 14, color: COLORS.textLight, marginTop: 12 },
    emptyText: { fontSize: 16, color: COLORS.textLight, marginTop: 16 },
    bidCard: {
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    bidHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    bidAmount: { fontSize: 20, fontWeight: '700', color: COLORS.accent },
    bidDetail: { fontSize: 13, color: COLORS.textLight, marginBottom: 2 },
    bidNotes: { fontSize: 13, color: COLORS.darkGray, marginTop: 6, fontStyle: 'italic' },
});
