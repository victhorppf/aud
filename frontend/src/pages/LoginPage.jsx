import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useNotification } from '../hooks/useNotification';

function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const notify = useNotification();

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            notify("Por favor, preencha todos os campos.", "warning");
            return;
        }
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate('/home');
        } catch (err) {
            notify("Falha no login. Verifique suas credenciais.", "error");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
                <img src="https://i.imgur.com/TN9JSD7.png" alt="Logo da PolarAUD" className="mx-auto h-52 w-auto" />
                <p className="text-center text-gray-500">Acesse sua conta de auditoria</p>
                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="text-sm font-medium text-gray-600">Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-2 mt-2 text-base text-gray-700 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="seu.email@exemplo.com" />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-600">Senha</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-2 mt-2 text-base text-gray-700 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="********" />
                    </div>
                    <button type="submit" disabled={loading} className="w-full px-4 py-3 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-300 disabled:bg-blue-400">
                        {loading ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>
                <p className="text-sm text-center text-gray-500">Não tem uma conta? <Link to="/register" className="font-medium text-blue-600 hover:underline">Registre-se</Link></p>
            </div>
        </div>
    );
}

export default LoginPage;