import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const ShippingAddressScreen = () => {
  const navigation = useNavigation();

  return (
    <ScrollView style={styles.container}>

    <View style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Shipping Address</Text>
      </View>
      
        

        <Text style={styles.label}>Full Name</Text>
        <TextInput style={styles.input} placeholder="John Doe" color="gray" />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput style={styles.input} placeholder="(123) 456-7890" keyboardType="phone-pad" color="gray" />

        <Text style={styles.label}>Address Line 1</Text>
        <TextInput style={styles.input} placeholder="1234 Main St" />

        <Text style={styles.label}>Address Line 2 (optional)</Text>
        <TextInput style={styles.input} placeholder="Apt, Suite, Floor" />

        <Text style={styles.label}>City</Text>
        <TextInput style={styles.input} placeholder="Los Angeles" />

        <Text style={styles.label}>State/Province/Region</Text>
        <TextInput style={styles.input} placeholder="California" />

        <Text style={styles.label}>Postal Code</Text>
        <TextInput style={styles.input} placeholder="90001" />

        <Text style={styles.label}>Country</Text>
        <TextInput style={styles.input} placeholder="USA" />

        <TouchableOpacity style={styles.button} onPress={() => {/* Save the address or navigate to another screen */}}>
          <Text style={styles.buttonText}>Save Address</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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


export default ShippingAddressScreen;
