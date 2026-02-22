import React from 'react';
import { TouchableOpacity, Text, View, ScrollView, TextInput, Dimensions, StyleSheet } from 'react-native';
import { FontAwesome as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import ProfilePicture from './ProfilePicture';

import AccountInformationScreen from './AccountInformationScreen';
const { width, height } = Dimensions.get('window');
const Settings = ({ setShowState, showState, buttonPressCounts, setButtonPressCounts }) => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
    <ProfilePicture initialImage="https://example.com/default-avatar.png" />

      <TouchableOpacity style={styles.button_1} onPress={() => navigation.goBack()}>
        <Icon name="arrow-left" size={24} color="black" />
        <Text>Back</Text>
      </TouchableOpacity>

      <ScrollView style={styles.settingsList}>
        <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('AccountInformationScreen')}>
          <Text style={styles.settingText}>Account Information</Text>
          <Icon name="chevron-right" size={24} color="grey" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('PaymentOptionsScreen')}>
          <Text style={styles.settingText}>Payment Options</Text>
          <Icon name="chevron-right" size={24} color="grey" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('ShippingAddressScreen')}>
  <Text style={styles.settingText}>Shipping Address</Text>
  <Icon name="chevron-right" size={24} color="grey" />
</TouchableOpacity>

<TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('NotificationPreferencesScreen')}>
  <Text style={styles.settingText}>Notification Preferences</Text>
  <Icon name="chevron-right" size={24} color="grey" />
</TouchableOpacity>

<TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('PrivacyOptionsScreen')}>
  <Text style={styles.settingText}>Privacy Options</Text>
  <Icon name="chevron-right" size={24} color="grey" />
</TouchableOpacity>

        {/* Add more settings options as needed */}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  button_1: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderBottomWidth: 0.5,
    borderColor: '#D1D1D1',
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: '#3498db',
    height: 60, 
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
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
  },
  settingsList: {
    flex: 1,
    paddingHorizontal: 15,
    marginTop: 10,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomColor: '#E0E0E0',
    borderBottomWidth: 1,
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    marginVertical: 5,
    borderRadius: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  settingText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    marginBottom: 20,
    lineHeight: 20,
  },
  iconWithLabel: {
    flexDirection: 'column',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  profilePictureContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  backIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: 18,
    marginLeft: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#d1d1d1',
  },
  footerButton: {
    padding: 10,
  },
  menuItem: {
    fontSize: 16,
    paddingVertical: 10,
    borderBottomColor: '#e0e0e0',
    borderBottomWidth: 0.5,
    color: '#333',
  },
});

export default Settings;
