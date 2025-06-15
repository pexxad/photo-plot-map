import React from 'react';
import { DatePicker, Space } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

interface DateRangeFilterProps {
  onDateRangeChange: (startDate: Date | null, endDate: Date | null) => void;
  disabled?: boolean;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ onDateRangeChange, disabled = false }) => {
  const handleChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates) {
      const [start, end] = dates;
      onDateRangeChange(
        start ? start.toDate() : null,
        end ? end.toDate() : null
      );
    } else {
      onDateRangeChange(null, null);
    }
  };

  return (
    <Space>
      <CalendarOutlined style={{ color: '#fff' }} />
      <RangePicker
        onChange={handleChange}
        disabled={disabled}
        placeholder={['Start Date', 'End Date']}
        style={{ width: 260 }}
        size="middle"
      />
    </Space>
  );
};

export default DateRangeFilter;