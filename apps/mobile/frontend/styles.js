/**
 * EcoWoods Shared Styles
 */

import { StyleSheet, Platform } from 'react-native';

export const COLORS = {
    primary: '#2C3E50',
    primaryLight: '#34495E',
    accent: '#27AE60',
    accentDark: '#219A52',
    blue: '#2980B9',
    orange: '#E67E22',
    red: '#E74C3C',
    white: '#FFFFFF',
    offWhite: '#F0F2F5',
    lightGray: '#E0E0E0',
    gray: '#999999',
    darkGray: '#555555',
    text: '#333333',
    textLight: '#777777',
    cardBg: '#FFFFFF',
    success: '#27AE60',
    warning: '#F39C12',
    danger: '#E74C3C',
};

const styles = StyleSheet.create({
    // ===== Layout =====
    container: {
        flex: 1,
        backgroundColor: COLORS.offWhite,
    },
    scrollContainer: {
        flexGrow: 1,
        padding: 20,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.offWhite,
    },

    // ===== Header =====
    header: {
        backgroundColor: COLORS.primary,
        paddingTop: Platform.OS === 'ios' ? 50 : 40,
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.white,
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 4,
    },

    // ===== Cards =====
    card: {
        backgroundColor: COLORS.cardBg,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 8,
    },
    cardText: {
        fontSize: 14,
        color: COLORS.textLight,
        lineHeight: 20,
    },

    // ===== Buttons =====
    button: {
        backgroundColor: COLORS.accent,
        borderRadius: 10,
        paddingVertical: 14,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '600',
    },
    buttonOutline: {
        backgroundColor: 'transparent',
        borderRadius: 10,
        paddingVertical: 14,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: COLORS.accent,
    },
    buttonOutlineText: {
        color: COLORS.accent,
        fontSize: 16,
        fontWeight: '600',
    },
    buttonDisabled: {
        backgroundColor: COLORS.lightGray,
    },

    // ===== Forms =====
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.textLight,
        marginBottom: 6,
        marginTop: 12,
    },
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
    textArea: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.lightGray,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: COLORS.text,
        minHeight: 100,
        textAlignVertical: 'top',
    },

    // ===== Badges =====
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '500',
    },

    // ===== Sections =====
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 12,
        marginTop: 8,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.lightGray,
        marginVertical: 12,
    },

    // ===== Row Layout =====
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rowBetween: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },

    // ===== Error =====
    errorText: {
        color: COLORS.red,
        fontSize: 13,
        textAlign: 'center',
        marginTop: 8,
    },

    // ===== Option Buttons (for multi-select) =====
    optionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 8,
    },
    optionButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: COLORS.lightGray,
        backgroundColor: COLORS.white,
    },
    optionButtonSelected: {
        borderColor: COLORS.accent,
        backgroundColor: '#E8F5E9',
    },
    optionText: {
        fontSize: 14,
        color: COLORS.textLight,
    },
    optionTextSelected: {
        color: COLORS.accent,
        fontWeight: '600',
    },
});

export default styles;
