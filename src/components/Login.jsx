import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const Login = () => {
    const { isAuthenticated, login } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/home');
        }
    }, [isAuthenticated, navigate]);

    const buttonStyles = {
        width: '100%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1.5rem',
        fontSize: '0.875rem',
        fontWeight: '500',
        borderRadius: '9999px',
        border: '1px solid white',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        transition: 'background-color 200ms',
        color: 'white'
    };

    const handleLogin = async () => {
        try {
            await login();
        } catch (error) {
            console.error('Login failed:', error);
        }
    };

    return (
        <button
            onClick={handleLogin}
            style={{
                ...buttonStyles,
                backgroundColor: '#003594',
            }}
            onMouseEnter={e => e.target.style.backgroundColor = '#002970'}
            onMouseLeave={e => e.target.style.backgroundColor = '#003594'}
        >
            <svg 
                style={{ width: '1.125rem', height: '1.125rem' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            <span>Iniciar sesión con Microsoft</span>
        </button>
    );
};

export default Login; 