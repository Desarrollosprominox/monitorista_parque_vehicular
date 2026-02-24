import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function BranchBarChart({ data }) {
  // Procesar datos para contar tickets por sucursal
  const processedData = Object.entries(
    data.reduce((acc, ticket) => {
      const branch = ticket.amv_sucursal || 'No especificada';
      acc[branch] = (acc[branch] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  return (
    <div className="bg-white rounded-xl p-4 shadow">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Solicitudes por Sucursal</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#003594" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default BranchBarChart; 