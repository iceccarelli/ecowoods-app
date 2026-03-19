/**
 * JobRequestScreen - Multi-step form for creating a new job request.
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useStore from '../context/useStore';
import { COLORS } from '../styles';

const SERVICES = [
    'Hardwood Installation',
    'Hardwood Refinishing',
    'Hardwood Repair',
    'Laminate Installation',
    'Vinyl Installation',
    'Tile Installation',
    'Subfloor Repair',
    'Demolition & Removal',
];

const WOOD_TYPES = ['Oak', 'Maple', 'Walnut', 'Cherry', 'Hickory', 'Birch', 'Ash', 'Other'];
const WIDTHS = ['2.25"', '3.25"', '4"', '5"', '6"', '7"+'];
const THICKNESSES = ['3/8"', '1/2"', '5/8"', '3/4"'];
const COLORS_LIST = ['Natural', 'Light', 'Medium', 'Dark', 'Ebony', 'Gray', 'White'];
const PROPERTY_TYPES = ['House', 'Condo', 'Apartment', 'Commercial', 'Other'];
const HOME_LEVELS = ['Single Level', 'Multi Level', 'Basement Only', 'Stairs Included'];
const SUBFLOOR_TYPES = ['Plywood', 'Concrete', 'OSB', 'Existing Hardwood', 'Unknown'];
const TIMEFRAMES = ['ASAP', 'Within 2 weeks', '1 month', '2-3 months', 'Flexible'];

const STEPS = ['Services', 'Flooring Details', 'Property Info', 'Contact & Submit'];

export default function JobRequestScreen({ navigation }) {
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);

    // Form state
    const [selectedServices, setSelectedServices] = useState([]);
    const [size, setSize] = useState('');
    const [woodType, setWoodType] = useState('');
    const [width, setWidth] = useState('');
    const [thickness, setThickness] = useState('');
    const [color, setColor] = useState('');
    const [propertyType, setPropertyType] = useState('');
    const [homeLevels, setHomeLevels] = useState('');
    const [demolition, setDemolition] = useState('');
    const [subfloorType, setSubfloorType] = useState('');
    const [timeframe, setTimeframe] = useState('');
    const [additionalDetails, setAdditionalDetails] = useState('');
    const [contactName, setContactName] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactPhone, setContactPhone] = useState('');

    const { createJobRequest, user } = useStore();

    const toggleService = (svc) => {
        setSelectedServices((prev) =>
            prev.includes(svc) ? prev.filter((s) => s !== svc) : [...prev, svc]
        );
    };

    const handleSubmit = async () => {
        if (selectedServices.length === 0) {
            Alert.alert('Error', 'Please select at least one service.');
            return;
        }

        setLoading(true);
        try {
            await createJobRequest({
                services: selectedServices,
                size: size || null,
                wood_type: woodType || null,
                width: width || null,
                thickness: thickness || null,
                color: color || null,
                property_type: propertyType || null,
                home_levels: homeLevels || null,
                demolition_required: demolition || null,
                subfloor_type: subfloorType || null,
                timeframe: timeframe || null,
                additional_details: additionalDetails || null,
                contact_name: contactName || user?.full_name || null,
                contact_email: contactEmail || user?.email || null,
                contact_phone: contactPhone || user?.phone || null,
            });
            Alert.alert('Success', 'Your job request has been submitted!', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        } catch (e) {
            Alert.alert('Error', e.message || 'Failed to submit job request.');
        } finally {
            setLoading(false);
        }
    };

    const nextStep = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
    const prevStep = () => setStep((s) => Math.max(s - 1, 0));

    const OptionButton = ({ label, selected, onPress }) => (
        <TouchableOpacity
            style={[s.optionBtn, selected && s.optionBtnSelected]}
            onPress={onPress}
        >
            <Text style={[s.optionText, selected && s.optionTextSelected]}>{label}</Text>
        </TouchableOpacity>
    );

    const renderStep = () => {
        switch (step) {
            case 0:
                return (
                    <View>
                        <Text style={s.stepTitle}>Select Services</Text>
                        <Text style={s.stepDesc}>Choose one or more services you need.</Text>
                        <View style={s.optionGrid}>
                            {SERVICES.map((svc) => (
                                <OptionButton
                                    key={svc}
                                    label={svc}
                                    selected={selectedServices.includes(svc)}
                                    onPress={() => toggleService(svc)}
                                />
                            ))}
                        </View>
                    </View>
                );
            case 1:
                return (
                    <View>
                        <Text style={s.stepTitle}>Flooring Details</Text>

                        <Text style={s.label}>Approximate Size (sq ft)</Text>
                        <TextInput
                            style={s.input}
                            placeholder="e.g., 500"
                            value={size}
                            onChangeText={setSize}
                            keyboardType="numeric"
                        />

                        <Text style={s.label}>Wood Type</Text>
                        <View style={s.optionGrid}>
                            {WOOD_TYPES.map((w) => (
                                <OptionButton key={w} label={w} selected={woodType === w} onPress={() => setWoodType(w)} />
                            ))}
                        </View>

                        <Text style={s.label}>Width</Text>
                        <View style={s.optionGrid}>
                            {WIDTHS.map((w) => (
                                <OptionButton key={w} label={w} selected={width === w} onPress={() => setWidth(w)} />
                            ))}
                        </View>

                        <Text style={s.label}>Thickness</Text>
                        <View style={s.optionGrid}>
                            {THICKNESSES.map((t) => (
                                <OptionButton key={t} label={t} selected={thickness === t} onPress={() => setThickness(t)} />
                            ))}
                        </View>

                        <Text style={s.label}>Color Preference</Text>
                        <View style={s.optionGrid}>
                            {COLORS_LIST.map((c) => (
                                <OptionButton key={c} label={c} selected={color === c} onPress={() => setColor(c)} />
                            ))}
                        </View>
                    </View>
                );
            case 2:
                return (
                    <View>
                        <Text style={s.stepTitle}>Property Information</Text>

                        <Text style={s.label}>Property Type</Text>
                        <View style={s.optionGrid}>
                            {PROPERTY_TYPES.map((p) => (
                                <OptionButton key={p} label={p} selected={propertyType === p} onPress={() => setPropertyType(p)} />
                            ))}
                        </View>

                        <Text style={s.label}>Home Levels</Text>
                        <View style={s.optionGrid}>
                            {HOME_LEVELS.map((h) => (
                                <OptionButton key={h} label={h} selected={homeLevels === h} onPress={() => setHomeLevels(h)} />
                            ))}
                        </View>

                        <Text style={s.label}>Demolition Required?</Text>
                        <View style={s.optionGrid}>
                            {['Yes', 'No', 'Not Sure'].map((d) => (
                                <OptionButton key={d} label={d} selected={demolition === d} onPress={() => setDemolition(d)} />
                            ))}
                        </View>

                        <Text style={s.label}>Subfloor Type</Text>
                        <View style={s.optionGrid}>
                            {SUBFLOOR_TYPES.map((sf) => (
                                <OptionButton key={sf} label={sf} selected={subfloorType === sf} onPress={() => setSubfloorType(sf)} />
                            ))}
                        </View>

                        <Text style={s.label}>Preferred Timeframe</Text>
                        <View style={s.optionGrid}>
                            {TIMEFRAMES.map((tf) => (
                                <OptionButton key={tf} label={tf} selected={timeframe === tf} onPress={() => setTimeframe(tf)} />
                            ))}
                        </View>
                    </View>
                );
            case 3:
                return (
                    <View>
                        <Text style={s.stepTitle}>Contact & Review</Text>

                        <Text style={s.label}>Contact Name</Text>
                        <TextInput
                            style={s.input}
                            placeholder={user?.full_name || 'Your name'}
                            value={contactName}
                            onChangeText={setContactName}
                        />

                        <Text style={s.label}>Email</Text>
                        <TextInput
                            style={s.input}
                            placeholder={user?.email || 'your@email.com'}
                            value={contactEmail}
                            onChangeText={setContactEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />

                        <Text style={s.label}>Phone</Text>
                        <TextInput
                            style={s.input}
                            placeholder="(555) 123-4567"
                            value={contactPhone}
                            onChangeText={setContactPhone}
                            keyboardType="phone-pad"
                        />

                        <Text style={s.label}>Additional Details</Text>
                        <TextInput
                            style={[s.input, { minHeight: 100, textAlignVertical: 'top' }]}
                            placeholder="Any special requirements or notes..."
                            value={additionalDetails}
                            onChangeText={setAdditionalDetails}
                            multiline
                        />

                        {/* Summary */}
                        <View style={s.summaryCard}>
                            <Text style={s.summaryTitle}>Request Summary</Text>
                            <Text style={s.summaryItem}>Services: {selectedServices.join(', ') || 'None selected'}</Text>
                            {woodType ? <Text style={s.summaryItem}>Wood: {woodType}</Text> : null}
                            {size ? <Text style={s.summaryItem}>Size: {size} sq ft</Text> : null}
                            {propertyType ? <Text style={s.summaryItem}>Property: {propertyType}</Text> : null}
                            {timeframe ? <Text style={s.summaryItem}>Timeframe: {timeframe}</Text> : null}
                        </View>
                    </View>
                );
            default:
                return null;
        }
    };

    return (
        <View style={s.container}>
            {/* Progress Bar */}
            <View style={s.progressContainer}>
                {STEPS.map((label, i) => (
                    <View key={i} style={s.progressStep}>
                        <View style={[s.progressDot, i <= step && s.progressDotActive]}>
                            {i < step ? (
                                <Ionicons name="checkmark" size={14} color={COLORS.white} />
                            ) : (
                                <Text style={[s.progressNum, i <= step && s.progressNumActive]}>{i + 1}</Text>
                            )}
                        </View>
                        <Text style={[s.progressLabel, i <= step && s.progressLabelActive]}>{label}</Text>
                    </View>
                ))}
            </View>

            <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
                {renderStep()}
            </ScrollView>

            {/* Navigation Buttons */}
            <View style={s.navRow}>
                {step > 0 ? (
                    <TouchableOpacity style={s.navBtnOutline} onPress={prevStep}>
                        <Ionicons name="arrow-back" size={18} color={COLORS.accent} />
                        <Text style={s.navBtnOutlineText}>Back</Text>
                    </TouchableOpacity>
                ) : (
                    <View />
                )}

                {step < STEPS.length - 1 ? (
                    <TouchableOpacity style={s.navBtn} onPress={nextStep}>
                        <Text style={s.navBtnText}>Next</Text>
                        <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[s.navBtn, loading && { backgroundColor: COLORS.lightGray }]}
                        onPress={handleSubmit}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={COLORS.white} />
                        ) : (
                            <>
                                <Text style={s.navBtnText}>Submit</Text>
                                <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.offWhite },
    progressContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 16,
        paddingHorizontal: 10,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.lightGray,
    },
    progressStep: { alignItems: 'center', flex: 1 },
    progressDot: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: COLORS.lightGray,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    progressDotActive: { backgroundColor: COLORS.accent },
    progressNum: { fontSize: 12, fontWeight: '600', color: COLORS.gray },
    progressNumActive: { color: COLORS.white },
    progressLabel: { fontSize: 10, color: COLORS.gray, textAlign: 'center' },
    progressLabelActive: { color: COLORS.accent, fontWeight: '600' },
    scrollContent: { padding: 20, paddingBottom: 100 },
    stepTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
    stepDesc: { fontSize: 14, color: COLORS.textLight, marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '500', color: COLORS.textLight, marginTop: 16, marginBottom: 8 },
    input: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.lightGray,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: COLORS.text,
    },
    optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    optionBtn: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: COLORS.lightGray,
        backgroundColor: COLORS.white,
    },
    optionBtnSelected: { borderColor: COLORS.accent, backgroundColor: '#E8F5E9' },
    optionText: { fontSize: 13, color: COLORS.textLight },
    optionTextSelected: { color: COLORS.accent, fontWeight: '600' },
    summaryCard: {
        backgroundColor: '#F8F9FA',
        borderRadius: 12,
        padding: 16,
        marginTop: 20,
        borderWidth: 1,
        borderColor: COLORS.lightGray,
    },
    summaryTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
    summaryItem: { fontSize: 14, color: COLORS.textLight, marginBottom: 4 },
    navRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: COLORS.white,
        borderTopWidth: 1,
        borderTopColor: COLORS.lightGray,
    },
    navBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.accent,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 10,
        gap: 8,
    },
    navBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '600' },
    navBtnOutline: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: COLORS.accent,
        gap: 8,
    },
    navBtnOutlineText: { color: COLORS.accent, fontSize: 15, fontWeight: '600' },
});
