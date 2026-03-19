/**
 * BidDetailScreen - View details of a single bid.
 */

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { COLORS } from '../styles';

export default function BidDetailScreen({ route }) {
    const { bidId } = route.params || {};
    const [bid, setBid] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadBid();
    }, []);

    const loadBid = async () => {
        try {
            if (bidId) {
                const data = await api.getBid(bidId);
                setBid(data);
            }
        } catch (e) {
            console.warn('Failed to load bid:', e.message);
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

    if (!bid) {
        return (
            <View style={s.centered}>
                <Ionicons name="pricetag-outline" size={64} color={COLORS.lightGray} />
                <Text style={s.emptyText}>Bid not found.</Text>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={s.scroll}>
            {/* Amount Card */}
            <View style={s.amountCard}>
                <Text style={s.amountLabel}>Bid Amount</Text>
                <Text style={s.amountValue}>${parseFloat(bid.amount).toLocaleString()}</Text>
                <Text style={s.currency}>{bid.currency}</Text>
            </View>

            {/* Details Card */}
            <View style={s.card}>
                <Text style={s.cardTitle}>Bid Details</Text>
                <View style={s.divider} />

                <DetailRow label="Bid ID" value={`#${bid.id}`} />
                <DetailRow label="Job Request" value={`#${bid.job_request_id}`} />
                <DetailRow label="Status" value={bid.status} />
                {bid.timeframe && <DetailRow label="Timeframe" value={bid.timeframe} />}
                {bid.pickup_date && <DetailRow label="Pickup Date" value={bid.pickup_date} />}
                {bid.created_at && (
                    <DetailRow label="Created" value={new Date(bid.created_at).toLocaleDateString()} />
                )}
            </View>

            {/* Notes */}
            {bid.notes && (
                <View style={s.card}>
                    <Text style={s.cardTitle}>Notes</Text>
                    <View style={s.divider} />
                    <Text style={s.notesText}>{bid.notes}</Text>
                </View>
            )}
        </ScrollView>
    );
}

function DetailRow({ label, value }) {
    return (
        <View style={s.detailRow}>
            <Text style={s.detailLabel}>{label}</Text>
            <Text style={s.detailValue}>{value}</Text>
        </View>
    );
}

const s = StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.offWhite },
    emptyText: { fontSize: 16, color: COLORS.textLight, marginTop: 16 },
    scroll: { padding: 20 },
    amountCard: {
        backgroundColor: COLORS.accent,
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        marginBottom: 20,
    },
    amountLabel: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
    amountValue: { fontSize: 40, fontWeight: '700', color: COLORS.white, marginTop: 4 },
    currency: { fontSize: 16, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
    card: {
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    cardTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
    divider: { height: 1, backgroundColor: COLORS.lightGray, marginVertical: 12 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    detailLabel: { fontSize: 14, color: COLORS.textLight },
    detailValue: { fontSize: 14, fontWeight: '500', color: COLORS.text, textTransform: 'capitalize' },
    notesText: { fontSize: 14, color: COLORS.darkGray, lineHeight: 22 },
});
