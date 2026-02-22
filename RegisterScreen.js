import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import styles from './styles';
import { FontAwesome as Icon } from '@expo/vector-icons';


interface RegisterProps {
  navigation: any;
}

const RegisterScreen: React.FC<RegisterProps> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    setIsLoading(true);
    try {
      // Simulate API call for registration
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // TODO: Register the user in your system. For now, just a simulated delay.
      navigation.replace('Login'); // Navigate back to LoginScreen after registration
    } catch (err) {
      setError('Failed to register. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register with your Ecowoods</Text>
      <TextInput
        style={styles.input}
        placeholder="Username"
        onChangeText={setUsername}
        value={username}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        onChangeText={setPassword}
        value={password}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Register</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

export default RegisterScreen;
