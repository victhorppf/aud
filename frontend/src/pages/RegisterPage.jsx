import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, validateSecretFn } from '../services/firebase';
import { useNotification } from '../hooks/useNotification';

function RegisterPage() {
    const [step, setStep] = useState(1);
    const [secret, setSecret] = useState('');
    const [companyData, setCompanyData] = useState(null);
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        role: 'Auditor',
        sector: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const notify = useNotification();

    const handleValidateSecret = async () => {
        setError('');
        setLoading(true);
        try {
            const result = await validateSecretFn({ secret });
            setCompanyData(result.data);
            setFormData(prev => ({ ...prev, sector: result.data.sectors[0] }));
            setStep(2);
        } catch (err) {
            notify(err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            await sendEmailVerification(userCredential.user);

            await setDoc(doc(db, "users", userCredential.user.uid), {
                fullName: formData.fullName,
                email: formData.email,
                role: formData.role,
                sector: formData.sector,
                companyName: companyData.companyName,
                holdingName: companyData.holdingName,
                status: "PendingApproval",
                createdAt: serverTimestamp(),
            });

            notify("Verifique seu e-mail para continuar.", "info");
            navigate('/login');

        } catch (err) {
            notify(err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    if (step === 1) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="w-full max-w-sm p-8 space-y-4 bg-white rounded-xl shadow-lg">
                    <h2 className="text-2xl font-bold text-center text-gray-800">Acesso ao Registro</h2>
                    <p className="text-center text-gray-500">Insira o segredo para continuar.</p>
                    <input type="password" value={secret} onChange={e => setSecret(e.target.value)} className="w-full px-4 py-2 mt-2 text-base text-gray-700 bg-gray-100 border border-gray-300 rounded-lg" placeholder="holding@empresa@ano" />
                    <button onClick={handleValidateSecret} disabled={loading} className="w-full px-4 py-3 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-400">
                        {loading ? 'Verificando...' : 'Verificar'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 py-12">
            <div className="w-full max-w-lg p-8 space-y-6 bg-white rounded-xl shadow-lg">
                <h1 className="text-3xl font-bold text-center text-gray-800">Registro de Novo Usuário</h1>
                <form onSubmit={handleRegister} className="space-y-4">
                    <input value={`Holding: ${companyData.holdingName}`} className="w-full px-4 py-2 bg-gray-200 border rounded-lg" disabled />
                    <input value={`Empresa: ${companyData.companyName}`} className="w-full px-4 py-2 bg-gray-200 border rounded-lg" disabled />
                    <input name="fullName" onChange={handleChange} placeholder="Nome Completo" className="w-full px-4 py-2 bg-gray-100 border rounded-lg" required />
                    <input name="email" type="email" onChange={handleChange} placeholder="E-mail Corporativo" className="w-full px-4 py-2 bg-gray-100 border rounded-lg" required />
                    <input name="password" type="password" onChange={handleChange} placeholder="Senha (mínimo 6 caracteres)" className="w-full px-4 py-2 bg-gray-100 border rounded-lg" required />
                    <select name="role" onChange={handleChange} value={formData.role} className="w-full px-4 py-2 bg-gray-100 border rounded-lg">
                        <option value="Auditor">Auditor</option>
                        <option value="Executor">Executor</option>
                    </select>
                    <select name="sector" onChange={handleChange} value={formData.sector} className="w-full px-4 py-2 bg-gray-100 border rounded-lg">
                        {companyData.sectors.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button type="submit" disabled={loading} className="w-full px-4 py-3 font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-400">
                        {loading ? 'Registrando...' : 'Registrar'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default RegisterPage;