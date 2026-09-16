"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_1 = require("./src/config/supabase");
async function createBucket() {
    console.log('Creating chat-media bucket...');
    const { data, error } = await supabase_1.supabaseAdmin.storage.createBucket('chat-media', {
        public: true,
        fileSizeLimit: 10485760, // 10MB
    });
    if (error) {
        if (error.message.includes('already exists') || error.message.includes('Duplicate')) {
            console.log('Bucket already exists.');
        }
        else {
            console.error('Error creating bucket:', error);
        }
    }
    else {
        console.log('Bucket created:', data);
    }
}
createBucket();
//# sourceMappingURL=create-bucket.js.map