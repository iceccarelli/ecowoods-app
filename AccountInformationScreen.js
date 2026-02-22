import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert,StyleSheet } from 'react-native';
import ProfilePicture from './ProfilePicture';


const AccountInformationScreen = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');

  // Function to handle the update logic
  const handleUpdate = async () => {
    try {
      // Replace with your actual API endpoint
      const response = await fetch('https://yourapiendpoint.com/updateUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          mobile,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Show a success message or navigate to another screen.
        Alert.alert('Success', 'Your information has been updated.');
      } else {
        // Show an error message to the user
        Alert.alert('Error', 'Failed to update information. Please try again.');
      }
    } catch (error) {
      // Handle unexpected errors, e.g., network issues
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Personal Information</Text>
      </View>
    // Use a keyboard-aware component to ensure inputs don't get hidden behind the keyboard
    
    <ProfilePicture initialImage="https://example.com/default-avatar.png" />
      <Text style={styles.title}>Personal Information</Text>
      <Text style={styles.label}>First Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter First Name"
        value={firstName}
        onChangeText={setFirstName}
      />
      <Text style={styles.label}>Last Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter Last Name"
        value={lastName}
        onChangeText={setLastName}
      />
      <Text style={styles.label}>Email Address</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter Email Address"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
      />
      <Text style={styles.label}>Mobile Number</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter Mobile Number"
        value={mobile}
        onChangeText={setMobile}
        keyboardType="phone-pad"
      />
      {/* ...other sections and input fields... */}
      <TouchableOpacity style={styles.button} onPress={handleUpdate}>
        <Text style={styles.buttonText}>Update Information</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
    </View>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: '#3498db',
    height: 60, // You can adjust based on your device's status bar height
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    alignSelf: 'center'
  },
  label: {
    fontSize: 18,
    fontWeight: '500',
    color: '#555',
    marginTop: 20,
    marginBottom: 10
  },
  input: {
    height: 50,
    borderRadius: 5,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: '#fff',
    borderColor: '#d3d3d3',
    borderWidth: 1,
    color: '#333'
  },
  button: {
    marginTop: 30,
    backgroundColor: '#007BFF',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 18,
  }
});

export default AccountInformationScreen;
