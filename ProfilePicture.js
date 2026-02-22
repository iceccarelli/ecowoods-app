import React, { useState } from 'react';
import {
    View,
    Image,
    TouchableOpacity,
    KeyboardAvoidingView,
    Text,
    TextInput,
    Platform
} from 'react-native';
import { FontAwesome as Icon } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import styles from './styles';

const ProfilePicture = ({ initialImage }) => {
    const [image, setImage] = useState(initialImage);
    const [firstName, setFirstName] = useState(''); // Assuming you want to set the first name as well

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsEditing: true,
            aspect: [4, 4],
            quality: 1,
        });

        if (!result.cancelled) {
            setImage(result.uri);
        }
    };

    const handleUpdate = () => {
        // Handle profile update here
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <View style={{ alignItems: 'center', justifyContent: 'center', margin: 50 }}>
                <View style={styles.iconWithLabel}>
                    <View style={styles.iconContainer}>
                    
                       {<Icon name="user-plus" size={40} color="black" /> }{image ? 
                        
                            <Image source={{ uri: image }} style={{ width: 100, height: 100, borderRadius: 50 }} />:<Icon name="user-plus" size={40} color="black" /> 
                           
                        }
                    </View>
                </View>
                <TouchableOpacity onPress={pickImage} style={{ position: 'absolute', right: 0, bottom: 0 }}>
                    <Icon name="pencil" size={30} color="grey" />
                </TouchableOpacity>
            </View>
            <Text style={styles.label}>First Name</Text>
            <TextInput
                style={styles.input}
                placeholder="My Name"
                value={firstName}
                onChangeText={setFirstName}
            />
            <TouchableOpacity style={styles.button} onPress={handleUpdate}>
                <Text style={styles.buttonText}>Update Profile</Text>
            </TouchableOpacity>
        </KeyboardAvoidingView>
    );
};

export default ProfilePicture;
