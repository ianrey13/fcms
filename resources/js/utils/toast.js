// resources/js/utils/toast.js
import toast from 'react-hot-toast';

export const showToast = (type, message, options = {}) => {
    console.log(`🔔 showToast called: type=${type}, message=${message}`);
    
    const defaultOptions = {
        duration: 5000,
        position: 'top-right',
    };

    const opts = { ...defaultOptions, ...options };

    try {
        switch (type) {
            case 'success':
                toast.success(message, opts);
                break;
            case 'error':
                toast.error(message, opts);
                break;
            case 'warning':
                toast.warning(message, opts);
                break;
            case 'info':
                toast.info(message, opts);
                break;
            default:
                toast(message, opts);
        }
        console.log('✅ Toast displayed successfully');
    } catch (error) {
        console.error('❌ Failed to show toast:', error);
    }
};

export default toast;