import app from './src/app.js';
import connectDB from './src/configs/db.js';
import config from './src/configs/env.js';
const main = async () => {
    await connectDB();
    app.listen(config.PORT, () => {
        console.log(`Server is running on port ${config.PORT}`);
    });
};

main();
