/**
 * RegisterScreen - New user registration.
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useStore from '../context/useStore';
import { COLORS } from '../styles';

export default function RegisterScreen({ navigation }) {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const register = useStore((s) => s.register);
    const login = useStore((s) => s.login);

    const handleRegister = async () => {
        if (!username.trim() || !password.trim()) {
            setError('Username and password are required.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (password.length < 4) {
            setError('Password must be at least 4 characters.');
            return;
        }

        setError('');
        setLoading(true);
        try {
            await register(username.trim(), password, email.trim() || null, fullName.trim() || null);
            // Auto-login after successful registration
            await login(username.trim(), password);
        } catch (e) {
            setError(e.message || 'Registration failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={s.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
                <View style={s.headerSection}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                    </TouchableOpacity>
                    <Text style={s.title}>Create Account</Text>
                    <Text style={s.subtitle}>Join EcoWoods Hardwood</Text>
                </View>

                <View style={s.formCard}>
                    <View style={s.inputGroup}>
                        <Ionicons name="person-outline" size={20} color={COLORS.gray} style={s.inputIcon} />
                        <TextInput
                            style={s.input}
                            placeholder="Username *"
                            placeholderTextColor={COLORS.gray}
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <View style={s.inputGroup}>
                        <Ionicons name="person-circle-outline" size={20} color={COLORS.gray} style={s.inputIcon} />
                        <TextInput
                            style={s.input}
                            placeholder="Full Name"
                            placeholderTextColor={COLORS.gray}
                            value={fullName}
                            onChangeText={setFullName}
                        />
                    </View>

                    <View style={s.inputGroup}>
                        <Ionicons name="mail-outline" size={20} color={COLORS.gray} style={s.inputIcon} />
                        <TextInput
                            style={s.input}
                            placeholder="Email"
                            placeholderTextColor={COLORS.gray}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={s.inputGroup}>
                        <Ionicons name="lock-closed-outline" size={20} color={COLORS.gray} style={s.inputIcon} />
                        <TextInput
                            style={s.input}
                            placeholder="Password *"
                            placeholderTextColor={COLORS.gray}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    <View style={s.inputGroup}>
                        <Ionicons name="lock-closed-outline" size={20} color={COLORS.gray} style={s.inputIcon} />
                        <TextInput
                            style={s.input}
                            placeholder="Confirm Password *"
                            placeholderTextColor={COLORS.gray}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry
                        />
                    </View>

                    {error ? <Text style={s.errorText}>{error}</Text> : null}

                    <TouchableOpacity
                        style={[s.registerBtn, loading && s.registerBtnDisabled]}
                        onPress={handleRegister}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={COLORS.white} />
                        ) : (
                            <Text style={s.registerBtnText}>Create Account</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={s.loginLink}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={s.loginText}>
                            Already have an account? <Text style={s.loginBold}>Sign In</Text>
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.primary,
    },
    scroll: {
        flexGrow: 1,
        padding: 24,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
    },
    headerSection: {
        marginBottom: 24,
    },
    backBtn: {
        marginBottom: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: COLORS.white,
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        marginTop: 4,
    },
    formCard: {
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 5,
    },
    inputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.offWhite,
        borderRadius: 10,
        marginBottom: 14,
        paddingHorizontal: 12,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        paddingVertical: 14,
        fontSize: 15,
        color: COLORS.text,
    },
    errorText: {
        color: COLORS.red,
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 12,
    },
    registerBtn: {
        backgroundColor: COLORS.accent,
        borderRadius: 10,
        paddingVertical: 15,
        alignItems: 'center',
        marginTop: 8,
    },
    registerBtnDisabled: {
        backgroundColor: COLORS.lightGray,
    },
    registerBtnText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '600',
    },
    loginLink: {
        marginTop: 20,
        alignItems: 'center',
    },
    loginText: {
        fontSize: 14,
        color: COLORS.textLight,
    },
    loginBold: {
        color: COLORS.accent,
        fontWeight: '600',
    },
});
