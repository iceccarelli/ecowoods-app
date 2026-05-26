/**
 * LoginScreen - User authentication screen.
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useStore from '../context/useStore';
import { COLORS } from '../styles';

export default function LoginScreen({ navigation }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const login = useStore((s) => s.login);

    const handleLogin = async () => {
        if (!username.trim() || !password.trim()) {
            setError('Please enter both username and password.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            await login(username.trim(), password);
        } catch (e) {
            setError(e.message || 'Login failed. Please try again.');
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
                <View style={s.logoSection}>
                    <View style={s.iconCircle}>
                        <Ionicons name="leaf" size={48} color={COLORS.accent} />
                    </View>
                    <Text style={s.title}>EcoWoods</Text>
                    <Text style={s.subtitle}>Hardwood Flooring Solutions</Text>
                </View>

                <View style={s.formCard}>
                    <Text style={s.formTitle}>Welcome Back</Text>

                    <View style={s.inputGroup}>
                        <Ionicons name="person-outline" size={20} color={COLORS.gray} style={s.inputIcon} />
                        <TextInput
                            style={s.input}
                            placeholder="Username"
                            placeholderTextColor={COLORS.gray}
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <View style={s.inputGroup}>
                        <Ionicons name="lock-closed-outline" size={20} color={COLORS.gray} style={s.inputIcon} />
                        <TextInput
                            style={s.input}
                            placeholder="Password"
                            placeholderTextColor={COLORS.gray}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeIcon}>
                            <Ionicons
                                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                size={20}
                                color={COLORS.gray}
                            />
                        </TouchableOpacity>
                    </View>

                    {error ? <Text style={s.errorText}>{error}</Text> : null}

                    <TouchableOpacity
                        style={[s.loginBtn, loading && s.loginBtnDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={COLORS.white} />
                        ) : (
                            <Text style={s.loginBtnText}>Sign In</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={s.registerLink}
                        onPress={() => navigation.navigate('Register')}
                    >
                        <Text style={s.registerText}>
                            Don't have an account? <Text style={s.registerBold}>Sign Up</Text>
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
        justifyContent: 'center',
        padding: 24,
    },
    logoSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    iconCircle: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 32,
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
    formTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: COLORS.text,
        textAlign: 'center',
        marginBottom: 24,
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
    eyeIcon: {
        padding: 4,
    },
    errorText: {
        color: COLORS.red,
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 12,
    },
    loginBtn: {
        backgroundColor: COLORS.accent,
        borderRadius: 10,
        paddingVertical: 15,
        alignItems: 'center',
        marginTop: 8,
    },
    loginBtnDisabled: {
        backgroundColor: COLORS.lightGray,
    },
    loginBtnText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '600',
    },
    registerLink: {
        marginTop: 20,
        alignItems: 'center',
    },
    registerText: {
        fontSize: 14,
        color: COLORS.textLight,
    },
    registerBold: {
        color: COLORS.accent,
        fontWeight: '600',
    },
});
