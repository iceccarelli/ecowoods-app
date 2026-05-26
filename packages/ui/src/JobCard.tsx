import React from 'react';
export const JobCard = ({ job }: any) => (
  <div className="bg-white rounded-3xl p-6 border hover:shadow-xl transition-all">
    <h3 className="font-semibold text-xl text-[#0A3D2E]">{job.title}</h3>
    <p className="text-sm text-gray-500">{job.address}</p>
    <div className="mt-4 text-2xl font-bold text-[#0A3D2E]">${job.budget_min}</div>
  </div>
);
