import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Inicio from './components/Login/Inicio';
import Principal from './components/Principal/Principal';
import Registro from './components/Login/Registro';
import Socios from './components/Socios/socios';
import AgregarSocio from './components/Socios/AgregarSocio';
import EditarSocio from './components/Socios/EditarSocio';
import SociosBaja from './components/Socios/SociosBaja';
import Cuotas from './components/Cuotas/Cuotas'; // ✅ nombre correcto

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/panel" element={<RutaProtegida componente={<Principal />} />} />
        <Route path="/registro" element={<RutaProtegida componente={<Registro />} />} />
        <Route path="/socios" element={<RutaProtegida componente={<Socios />} />} />
        <Route path="/socios/agregar" element={<RutaProtegida componente={<AgregarSocio />} />} />
        <Route path="/socios/editar/:id" element={<RutaProtegida componente={<EditarSocio />} />} />
        <Route path="/socios/baja" element={<RutaProtegida componente={<SociosBaja />} />} />
        <Route path="/cuotas" element={<RutaProtegida componente={<Cuotas />} />} /> {/* ✅ nueva ruta */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

function RutaProtegida({ componente }) {
  const usuario = JSON.parse(localStorage.getItem('usuario'));
  return usuario ? componente : <Navigate to="/" />;
}

export default App;
