"use client";

type CrisisModalProps = {
  onDismiss: () => void;
};

const CrisisModal = ({ onDismiss }: CrisisModalProps) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-red-500 text-4xl mb-4 text-center">🆘</div>
        <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
          You are not alone
        </h2>
        <p className="text-gray-600 text-center mb-6">
          If you are in crisis, please reach out to one of these resources:
        </p>
        <div className="space-y-3 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="font-semibold text-red-800">
              988 Suicide & Crisis Lifeline
            </p>
            <p className="text-red-600">
              Call or text <strong>988</strong>
            </p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="font-semibold text-orange-800">Crisis Text Line</p>
            <p className="text-orange-600">
              Text <strong>HOME</strong> to <strong>741741</strong>
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="font-semibold text-gray-800">Emergency Services</p>
            <p className="text-gray-600">
              Call <strong>911</strong>
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg"
        >
          I am safe - continue session
        </button>
      </div>
    </div>
  );
};

export default CrisisModal;
