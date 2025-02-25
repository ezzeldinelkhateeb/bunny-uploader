import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md">
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
        <h2 className="text-2xl font-semibold text-gray-800">Page Not Found</h2>
        <p className="text-gray-600">
          Sorry, we couldn't find the page you're looking for. Please check the
          URL or return to the homepage.
        </p>
        <Button onClick={() => navigate("/")} className="mt-4" size="lg">
          Go Back Home
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
