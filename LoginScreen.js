import React, { useState } from 'react';
import { Image, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,KeyboardAvoidingView,Platform } from 'react-native';
import styles from './styles'; 

interface LoginProps {
  navigation: any;
}

const LoginScreen: React.FC<LoginProps> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setIsLoading(true);
    // Simulate API call
    try {
      // You'd typically make an actual API request with fetch or Axios here
      // For now, just a simulated delay
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      // TODO: Authenticate user. Check credentials, etc.
      // If success:
      navigation.replace('Home'); // Navigate to the HomeScreen after login
    } catch (err) {
      setError('Failed to log in. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
    <View style={styles.container}>
    
      <Text style={styles.title}>Welcome to Your</Text>
      <Image
          style={{ width: '100%', height: 50, resizeMode: 'contain' }}
          source={{ uri: "http://d14ty28lkqz1hw.cloudfront.net/data/org/15286/theme/21869/img/logo.png" }}
        />
        <Text style={styles.title}></Text>
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
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Log In</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={styles.registerLink}>Register</Text>
      </TouchableOpacity>
    </View>
    </KeyboardAvoidingView>
  );
};


export default LoginScreen;
