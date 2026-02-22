import React, { useState } from 'react';
import { View, Text, Switch, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { FontAwesome as Icon } from '@expo/vector-icons';

const NotificationPreferencesScreen = () => {
  const [dataSharing, setDataSharing] = React.useState(true);
  const [emailNotification, setEmailNotification] = useState(true);
  const [pushNotification, setPushNotification] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState({
    orders: true,
    promotions: true,
    updates: false,
    recommendations: false
  });

  const toggleCategory = (category) => {
    setSelectedCategories(prevState => ({
      ...prevState,
      [category]: !prevState[category]
    }));
  };

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => { /* Navigate back logic */ }}>
          <Icon name="arrow-left" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.title}>Notification Preferences</Text>
      </View>

      <ScrollView  >
      <View style={styles.settingItem}>
        <Text style={styles.settingText}>Email Notifications</Text>
        <Switch
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={emailNotification ? "#3498db" : "#f4f3f4"}
          onValueChange={() => setEmailNotification(!emailNotification)}
          value={emailNotification}
        />
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingText}>SMS Text Message Notifications</Text>
          <Switch
            trackColor={{ false: "#767577", true: "#81b0ff"  }}
            thumbColor={dataSharing ?  "#3498db" : "#f4f3f4"}
            onValueChange={() => setDataSharing(prev => !prev)}
            value={dataSharing}
          />
        </View>
<View style={styles.settingItem}>
        <Text style={styles.settingText}>Push Notifications</Text>
        <Switch
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={pushNotification ? "#3498db" : "#f4f3f4"}
          onValueChange={() => setPushNotification(!pushNotification)}
          value={pushNotification}
        />
        </View>

        <Text style={styles.label}>Categories</Text>
        {Object.keys(selectedCategories).map(category => (
          <TouchableOpacity key={category} style={styles.settingItem} onPress={() => toggleCategory(category)}>
            <Text style={styles.settingText}>{category.charAt(0).toUpperCase() + category.slice(1)}</Text>
            <Icon name={selectedCategories[category] ? "check-square" : "square"} size={24} color="grey" />
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Save Preferences</Text>
      </TouchableOpacity>
    </View>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
    fontSize: 18,
    fontWeight: '500',
    color: '#555',
    marginTop: 20,
    marginBottom: 10,
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


export default NotificationPreferencesScreen;
