import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE_URL from '../../config/config';
import './AgregarSocio.css';

const AgregarSocio = () => {
  const navigate = useNavigate();
  const [listas, setListas] = useState({ categorias: [], cobradores: [], estados: [] });
  const [formData, setFormData] = useState({
    nombre: '',
    id_cobrador: '',
    id_categoria: '',
    domicilio: '',
    numero: '',
    telefono_movil: '',
    telefono_fijo: '',
    comentario: '',
    nacimiento: '',
    id_estado: '',
    domicilio_cobro: '',
    dni: ''
  });
  const [errores, setErrores] = useState({});
  const [mostrarErrores, setMostrarErrores] = useState(false);

  useEffect(() => {
    const fetchListas = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api.php?action=listas`);
        const json = await res.json();
        if (json.exito) setListas(json.listas);
        else alert('❌ Error al cargar listas: ' + json.mensaje);
      } catch (err) {
        alert('❌ Error al conectar con el servidor para obtener listas');
      }
    };
    fetchListas();
  }, []);

  const validarCampo = (name, value) => {
    const soloNumeros = /^[0-9]+$/;
    const textoValido = /^[A-ZÑa-zñáéíóúÁÉÍÓÚ0-9\s.,-]*$/;

    switch (name) {
      case 'dni':
      case 'numero':
      case 'telefono_movil':
      case 'telefono_fijo':
        if (value && !soloNumeros.test(value)) return '❌ Solo se permiten números';
        if (value.length > 20) return '❌ Máximo 20 caracteres';
        break;
      case 'nombre':
      case 'domicilio':
        if (value && !textoValido.test(value)) {
          return '❌ Solo se permiten letras, números, espacios, puntos, comas, guiones y Ñ';
        }
        if (value.length > 100) return '❌ Máximo 100 caracteres';
        break;
      case 'comentario':
      case 'domicilio_cobro':
        if (value && !textoValido.test(value)) {
          return '❌ Solo se permiten letras, números, espacios, puntos, comas, guiones y Ñ';
        }
        if (value.length > 100) return '❌ Máximo 100 caracteres';
        break;
      default:
        return null;
    }
    return null;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const valor = value.toUpperCase();
    setFormData((prev) => ({ ...prev, [name]: valor }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMostrarErrores(true);
    const nuevosErrores = {};

    if (!formData.nombre.trim()) nuevosErrores.nombre = '⚠️ El nombre es obligatorio';

    Object.entries(formData).forEach(([key, value]) => {
      const error = validarCampo(key, value);
      if (error) nuevosErrores[key] = error;
    });

    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/api.php?action=agregar_socio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.exito) {
        alert('✅ Socio agregado correctamente');
        navigate('/socios');
      } else {
        if (data.errores) setErrores(data.errores);
        else alert('❌ Error: ' + data.mensaje);
      }
    } catch (error) {
      alert('❌ Error al conectar con el servidor');
    }
  };

  return (
    <div className="addsoc-container">
      <h2>Agregar Nuevo Socio</h2>
      <form className="addsoc-form" onSubmit={handleSubmit}>
        {[
          { name: 'nombre', placeholder: 'Nombre completo *' },
          { name: 'domicilio', placeholder: 'Domicilio' },
          { name: 'numero', placeholder: 'Número' },
          { name: 'telefono_movil', placeholder: 'Teléfono Móvil' },
          { name: 'telefono_fijo', placeholder: 'Teléfono Fijo' },
          { name: 'comentario', placeholder: 'Comentario' },
          { name: 'domicilio_cobro', placeholder: 'Domicilio de Cobro' },
          { name: 'dni', placeholder: 'DNI' },
        ].map(({ name, placeholder }) => (
          <div className="addsoc-field" key={name}>
            <input name={name} placeholder={placeholder} onChange={handleChange} />
            {mostrarErrores && errores[name] && (
              <span className="addsoc-error">{errores[name]}</span>
            )}
          </div>
        ))}

        <div className="addsoc-field">
          <select name="id_cobrador" onChange={handleChange}>
            <option value="">Seleccione Cobrador</option>
            {listas.cobradores.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        <div className="addsoc-field">
          <select name="id_categoria" onChange={handleChange}>
            <option value="">Seleccione Categoría</option>
            {listas.categorias.map(c => (
              <option key={c.id} value={c.id}>{c.descripcion}</option>
            ))}
          </select>
        </div>

        <div className="addsoc-field">
          <label className="addsoc-date-label">
            Fecha de nacimiento
            <input name="nacimiento" type="date" onChange={handleChange} />
          </label>
        </div>

        <div className="addsoc-field addsoc-last-field">
          <select name="id_estado" onChange={handleChange}>
            <option value="">Seleccione Estado</option>
            {listas.estados.map(e => (
              <option key={e.id} value={e.id}>{e.descripcion}</option>
            ))}
          </select>
        </div>

        <div className="addsoc-buttons">
          <button type="submit">Guardar</button>
          <button type="button" onClick={() => navigate('/socios')}>Cancelar</button>
        </div>
      </form>
    </div>
  );
};

export default AgregarSocio;