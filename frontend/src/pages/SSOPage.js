import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function SSOPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('Authenticating…');
    const [error, setError] = useState(null);

    useEffect(() => {
        const hotelToken = searchParams.get('token');

        if (!hotelToken) {
            setError('No SSO token provided.');
            setTimeout(() => navigate('/admin/login'), 2000);
            return;
        }

        const doSSO = async () => {
            try {
                setStatus('Verifying identity with Hotel PMS…');
                const response = await axios.post(
                    `${BACKEND_URL}/api/auth/hotel-sso`,
                    {},
                    { headers: { Authorization: `Bearer ${hotelToken}` } }
                );
                const { access_token } = response.data;
                localStorage.setItem('token', access_token);
                setStatus('Login successful! Redirecting to dashboard…');
                setTimeout(() => { window.location.href = '/admin/dashboard'; }, 500);
            } catch (err) {
                console.error('SSO failed:', err);
                setError('SSO failed. Please log in manually.');
                setTimeout(() => navigate('/admin/login'), 2000);
            }
        };

        doSSO();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
            <div className="text-center max-w-sm p-8 rounded-2xl bg-gray-800 shadow-xl">
                {error ? (
                    <>
                        <div className="text-4xl mb-4">⚠️</div>
                        <p className="text-red-400 font-semibold">{error}</p>
                        <p className="text-sm text-gray-400 mt-2">Redirecting to login…</p>
                    </>
                ) : (
                    <>
                        <div className="text-4xl mb-4">🔐</div>
                        <p className="text-lg font-semibold">{status}</p>
                        <div className="mt-4 flex justify-center">
                            <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
