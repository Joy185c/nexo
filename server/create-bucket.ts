import { supabaseAdmin } from './src/config/supabase';

async function createBucket() {
  console.log('Creating chat-media bucket...');
  const { data, error } = await supabaseAdmin.storage.createBucket('chat-media', {
    public: true,
    fileSizeLimit: 10485760, // 10MB
  });
  if (error) {
    if (error.message.includes('already exists') || error.message.includes('Duplicate')) {
      console.log('Bucket already exists.');
    } else {
      console.error('Error creating bucket:', error);
    }
  } else {
    console.log('Bucket created:', data);
  }
}
createBucket();
